/**
 * Sessions and switching between the two modes (overworld/, battle/). A session (join -> leave) is one connection;
 * this routes its messages, keeps the settings in sync, and runs the transitions: an encounter flashes into battle,
 * leaving a decided fight fades back to the overworld, where the server's result is applied and told.
 */
import type { AbstractEngine } from "@babylonjs/core";
import {
  moveItem as moveInBag, type Cell, type Character, type Look, type ServerMsgOf,
} from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import { frameSeconds } from "../core/time.js";
import { BATTLE_FRAMES, playerFrames } from "../gfx/characters.js";
import type { Pose, SwordPose } from "../gfx/look/battle.js";
import { CHIBI_FACINGS } from "../gfx/look/look.js";
import { redrawSprite } from "../gfx/sprites.js";
import type { Overworld } from "../overworld/overworld.js";
import type { Connection, Joined } from "../net/connection.js";
import { startPinging, type Pinging } from "../net/ping.js";
import { restoreSettings, syncSettings, type Settings } from "../settings/settings.js";
import { say } from "../ui/notifications/say.js";
import { bagHasTheKeys, inWorld, type UiState } from "../ui/state.js";
import { exposeDebugHandles } from "./debug.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

export interface Game {
  /** null outside a session. */
  mode(): Mode | null;
  /** On a connection the server has welcomed. */
  join(joined: Joined): void;
  /** Sends any unsent settings, hangs up, stops drawing, forgets the level and any fight. */
  leave(): void;
  /** Once the server's result is in: fade back to the overworld. */
  leaveBattle(): void;
  rest(): void;
  useItem(at: Cell): void;
  /** Shown at once, then the server answers with the bag as it has it. */
  moveItem(from: Cell, to: Cell, turned: boolean): void;
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
  let pinging: Pinging | null = null;
  let transition: Transition | null = null;
  /** The fight being flashed into or fought. */
  let encounter: ServerMsgOf<"encounter"> | null = null;
  /** Held while the player is still in the arena: applied when they leave it. */
  let result: ServerMsgOf<"battleResult"> | null = null;

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
    const to = net;
    if (!to) return;
    result = null;
    battle.start(msg, (m) => to.send(m));
    const enemy = msg.setup.enemies[0]?.def ?? { name: "something" };
    say(ui.notifications, { kind: "encounter", source: msg.source, enemy });
    setMode("battle");
  };

  const enterOverworld = () => {
    battle.end();
    net?.send({ t: "leaveBattle" });
    if (result) {
      overworld.onBattleResult(result);
      say(ui.notifications, { kind: "battleResult", outcome: result });
      result = null;
    }
    keyboard.clearPressed();
    setMode("overworld");
  };

  /** No character yet: the creation screen opens (it closes itself), and the server holds the level back. */
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
      if (mode !== "battle" || transition || !result) return;
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
      pinging = startPinging(net, (ms) => ui.ping.set({ ms }));
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
        battleHash: (msg) => battle.onHash(msg),
        battleSync: (msg) => battle.onSync(msg),
        battleResult(msg) {
          result = msg;
          battle.onResult(msg.won);
        },
        pong: (msg) => pinging?.pong(msg.id),
      });
      setMode("overworld");
      engine.runRenderLoop(() => frame(frameSeconds(engine)));
      exposeDebugHandles({
        battle, overworld, ui, settings, mode: () => mode,
        encounter: (enemy?: string) => net?.send({ t: "debug", cmd: "encounter", enemy }),
      });
    },
    leave() {
      if (!net) return;
      stopSync();
      stopSync = () => {};
      pinging?.stop();
      pinging = null;
      ui.ping.set({ ms: null });
      engine.stopRenderLoop();
      net.close();
      net = null;
      if (mode === "battle") battle.end();
      transition = encounter = result = null;
      overworld.leave();
      ui.settingsScreen.set({ open: false });
      ui.creation.set({ open: false });
      ui.notifications.clear();
      ui.screen.set({ fadeOpacity: 0 });
      setMode(null);
    },
  };
}

/** Paints the player's sprites, overworld and arena, in their look. */
function applyLook(battle: Battle, overworld: Overworld, look: Look): void {
  const frames = playerFrames(look);
  const arenaSprites = battle.ctx.materials.player;
  for (const pose of Object.keys(BATTLE_FRAMES) as (Pose | SwordPose)[]) {
    arenaSprites[pose].forEach((material, i) => redrawSprite(material, frames.battle[pose][i]!));
  }
  for (const facing of CHIBI_FACINGS) redrawSprite(overworld.view.materials.player[facing], frames.chibi[facing]);
}
