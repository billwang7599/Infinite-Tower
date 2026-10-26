/**
 * Mode switching and sessions. Two modes, two Babylon scenes, one ECS world:
 * - overworld: the 2D map (overworld/), its own fixed-step loop.
 * - battle:    the 2.5D arena (battle/), stepped by Babylon's lockstep + Havok.
 * Everything is built once. A session (join -> leave) is one connection to the server, which decides levels,
 * encounters and fight results; this routes its messages (one handler per message type), keeps the settings in
 * sync with it, and runs the transitions: an encounter flashes into battle, leaving a decided fight fades back
 * to the overworld.
 */
import type { AbstractEngine } from "@babylonjs/core";
import { moveItem as moveInBag, type Cell, type Character, type ServerMsgOf } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import { frameSeconds } from "../core/time.js";
import type { Overworld } from "../overworld/overworld.js";
import type { Connection, Joined } from "../net/connection.js";
import { restoreSettings, syncSettings, type Settings } from "../settings/settings.js";
import { say } from "../ui/notifications/say.js";
import { bagHasTheKeys, inWorld, type UiState } from "../ui/state.js";
import { exposeDebugHandles } from "./debug.js";
import { applyLook } from "./look.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

export interface Game {
  /** null outside a session. */
  mode(): Mode | null;
  /** Start a session on a connection the server has welcomed. */
  join(joined: Joined): void;
  /** End the session: send any unsent settings, hang up, stop drawing, forget the level and any fight. */
  leave(): void;
  /** The Leave key in a decided fight: fade back to the overworld. */
  leaveBattle(): void;
  rest(): void;
  useItem(at: Cell): void;
  /** Move a stack in the bag: shown at once, then the server answers with the bag as it has it. */
  moveItem(from: Cell, to: Cell, turned: boolean): void;
  /** Ask the server to save the new character (it answers with `character`). */
  saveCharacter(character: Character): void;
}

interface GameParts {
  engine: AbstractEngine;
  keyboard: Keyboard;
  mouse: Mouse;
  ui: UiState;
  settings: Settings;
  battle: Battle;
  overworld: Overworld;
}

export function createGame({ engine, keyboard, mouse, ui, settings, battle, overworld }: GameParts): Game {
  let mode: Mode | null = null;
  let net: Connection | null = null;
  let stopSync = () => {};
  let transition: Transition | null = null;
  /** The fight being flashed into or fought. */
  let encounter: ServerMsgOf<"encounter"> | null = null;

  /**
   * The game only gets input during a session with no screen over it (not even the title, still clearing off the
   * world, nor the open bag), and the mouse only in the arena (captured at once there if Auto mouse lock is on).
   */
  const updateInput = () => {
    const playing = inWorld(mode, ui.title.get().phase) && !ui.settingsScreen.get().open && !ui.creation.get().open;
    keyboard.enabled = playing && !bagHasTheKeys(mode, ui.overworldPanel.get().open);
    mouse.setLockable(playing && mode === "battle", settings.mouse.get().autoLock);
  };
  ui.settingsScreen.subscribe(updateInput);
  ui.creation.subscribe(updateInput);
  ui.overworldPanel.subscribe(updateInput);
  ui.title.subscribe(updateInput);
  updateInput();

  const setMode = (next: Mode | null) => {
    mode = next;
    // Panels are the overworld's: a fight, or leaving, closes them.
    if (next !== "overworld") ui.closeOverworldPanel();
    ui.screen.set({ mode: next });
    updateInput();
  };

  const enterBattle = (msg: ServerMsgOf<"encounter">) => {
    const { enemy, arena, vitals, stats, burden } = msg;
    battle.start(enemy, arena, vitals, stats, burden);
    say(ui.notifications, { kind: "encounter", source: msg.source, enemy: msg.enemy });
    setMode("battle");
  };

  const enterOverworld = () => {
    net?.send({ t: "battleEnd", ...battle.end() });
    keyboard.clearPressed();
    setMode("overworld");
  };

  /**
   * No character yet: the creation screen opens, and the server holds the level back until one is made. That
   * screen closes itself, once it has seen the saved character here and played out.
   */
  const applyCharacter = (character: Character | null) => {
    ui.overworld.set({ character });
    if (character) applyLook(battle, overworld, character.look);
    else ui.creation.set({ open: true });
  };

  const frame = (dt: number) => {
    if (transition) {
      const fade = stepTransition(transition, dt);
      ui.screen.set({ fadeColor: fade.color, fadeOpacity: fade.opacity });
      if (fade.swapNow) {
        if (transition.to === "overworld") enterOverworld();
        else if (encounter) enterBattle(encounter);
      }
      if (fade.done) transition = null;
    }
    if (mode === "overworld") {
      overworld.update(dt, transition !== null);
      overworld.render();
    } else if (mode === "battle") {
      battle.render();
    }
  };

  return {
    mode: () => mode,
    leaveBattle() {
      if (mode !== "battle" || transition) return;
      transition = startTransition("overworld");
    },
    rest() {
      if (mode === "overworld" && !transition) overworld.rest();
    },
    useItem(at) {
      if (mode === "overworld" && !transition) net?.send({ t: "useItem", at });
    },
    moveItem(from, to, turned) {
      if (mode !== "overworld" || transition || !net) return;
      const moved = moveInBag(ui.overworld.get().bag, from, to, turned);
      if (!moved) return;
      overworld.setBag(moved);
      net.send({ t: "moveItem", from, to, turned });
    },
    saveCharacter(character) {
      net?.send({ t: "character", character });
    },
    join(joined) {
      net = joined.net;
      restoreSettings(settings, joined.welcome.settings);
      stopSync = syncSettings(settings, net);
      // Before `listen`: the level may already be waiting in the connection's backlog.
      overworld.join(joined);
      applyCharacter(joined.welcome.character);
      net.listen({
        level: (msg) => overworld.onLevel(msg),
        state: (msg) => overworld.onState(msg),
        encounter(msg) {
          overworld.onEncounter(msg);
          encounter = msg;
          transition = startTransition("battle");
        },
        character: (msg) => applyCharacter(msg.character),
        rested(msg) {
          overworld.setVitals(msg.vitals);
          say(ui.notifications, { kind: "rested" });
        },
        itemUsed(msg) {
          overworld.setVitals(msg.vitals);
          overworld.setBag(msg.bag);
          say(ui.notifications, { kind: "itemUsed", item: msg.item });
        },
        bag: (msg) => overworld.setBag(msg.bag),
        battleResult(msg) {
          overworld.onBattleResult(msg);
          say(ui.notifications, { kind: "battleResult", outcome: msg });
        },
      });
      setMode("overworld");
      engine.runRenderLoop(() => frame(frameSeconds(engine)));
      exposeDebugHandles({
        battle, overworld, ui, settings, mode: () => mode, encounter: () => net?.send({ t: "debug", cmd: "encounter" }),
      });
    },
    leave() {
      if (!net) return;
      stopSync();
      stopSync = () => {};
      engine.stopRenderLoop();
      net.close();
      net = null;
      if (mode === "battle") battle.end();
      transition = encounter = null;
      overworld.leave();
      ui.settingsScreen.set({ open: false });
      ui.creation.set({ open: false });
      ui.notifications.clear();
      ui.screen.set({ fadeOpacity: 0 });
      setMode(null);
    },
  };
}
