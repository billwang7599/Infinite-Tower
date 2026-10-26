/**
 * Mode switching and sessions. Two modes, two Babylon scenes, one ECS world:
 * - field:  the 2D map (field/), its own fixed-step loop.
 * - battle: the 2.5D arena (battle/), stepped by Babylon's lockstep + Havok.
 * Everything is built once. A session (join -> leave) is one connection to the server, which decides levels,
 * encounters and fight results; this routes its messages (one handler per message type), keeps the settings in
 * sync with it, and runs the transitions: an encounter flashes into battle, leaving a decided fight fades back
 * to the field.
 */
import type { AbstractEngine } from "@babylonjs/core";
import {
  itemDef, type Cell, type Character, type ItemCounts, type ItemId, type ServerMsgOf,
} from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import { frameSeconds } from "../core/time.js";
import type { Field } from "../field/field.js";
import type { Connection, Joined } from "../net/connection.js";
import { restoreSettings, syncSettings, type Settings } from "../settings/settings.js";
import { inWorld, type UiState } from "../ui/state.js";
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
  /** The Leave key in a decided fight: fade back to the field. */
  leaveBattle(): void;
  rest(): void;
  useItem(at: Cell): void;
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
  field: Field;
}

export function createGame({ engine, keyboard, mouse, ui, settings, battle, field }: GameParts): Game {
  let mode: Mode | null = null;
  let net: Connection | null = null;
  let stopSync = () => {};
  let transition: Transition | null = null;
  /** The fight being flashed into or fought. */
  let encounter: ServerMsgOf<"encounter"> | null = null;

  /**
   * The game only gets input during a session with no screen over it (not even the title, still clearing off the
   * world), and the mouse only in the arena.
   */
  const updateInput = () => {
    const playing = inWorld(mode, ui.title.get().phase) && !ui.settingsScreen.get().open && !ui.creation.get().open;
    keyboard.enabled = playing;
    mouse.canLock = playing && mode === "battle";
    if (!mouse.canLock) mouse.unlock();
  };
  ui.settingsScreen.subscribe(updateInput);
  ui.creation.subscribe(updateInput);
  ui.title.subscribe(updateInput);
  updateInput();

  const setMode = (next: Mode | null) => {
    mode = next;
    ui.screen.set({ mode: next });
    updateInput();
  };

  const enterBattle = ({ source, enemy, arena, vitals, stats, burden }: ServerMsgOf<"encounter">) => {
    battle.start(enemy, arena, vitals, stats, burden);
    ui.showToast(source === null ? `A ${enemy.name} leaps out of the grass!` : `The ${enemy.name} attacks!`);
    setMode("battle");
  };

  const enterField = () => {
    net?.send({ t: "battleEnd", ...battle.end() });
    keyboard.clearPressed();
    setMode("field");
  };

  /**
   * No character yet: the creation screen opens, and the server holds the level back until one is made. That
   * screen closes itself, once it has seen the saved character here and played out.
   */
  const applyCharacter = (character: Character | null) => {
    ui.field.set({ character });
    if (character) applyLook(battle, field, character.look);
    else ui.creation.set({ open: true });
  };

  const frame = (dt: number) => {
    if (transition) {
      const fade = stepTransition(transition, dt);
      ui.screen.set({ fadeColor: fade.color, fadeOpacity: fade.opacity });
      if (fade.swapNow) {
        if (transition.to === "field") enterField();
        else if (encounter) enterBattle(encounter);
      }
      if (fade.done) transition = null;
    }
    if (mode === "field") {
      field.update(dt, transition !== null);
      field.render();
    } else if (mode === "battle") {
      battle.render();
    }
  };

  return {
    mode: () => mode,
    leaveBattle() {
      if (mode !== "battle" || transition) return;
      transition = startTransition("field");
    },
    rest() {
      if (mode === "field" && !transition) field.rest();
    },
    useItem(at) {
      if (mode === "field" && !transition) net?.send({ t: "useItem", at });
    },
    saveCharacter(character) {
      net?.send({ t: "character", character });
    },
    join(joined) {
      net = joined.net;
      restoreSettings(settings, joined.welcome.settings);
      stopSync = syncSettings(settings, net);
      // Before `listen`: the level may already be waiting in the connection's backlog.
      field.join(joined);
      applyCharacter(joined.welcome.character);
      net.listen({
        level: (msg) => field.onLevel(msg),
        state: (msg) => field.onState(msg),
        encounter(msg) {
          field.onEncounter(msg);
          encounter = msg;
          transition = startTransition("battle");
        },
        character: (msg) => applyCharacter(msg.character),
        rested(msg) {
          field.setVitals(msg.vitals);
          ui.showToast("You rest by the fire. HP and stamina are restored.");
        },
        itemUsed(msg) {
          field.setVitals(msg.vitals);
          field.setBag(msg.bag);
          const def = itemDef(msg.item);
          ui.showToast(`${def.verb === "Eat" ? "You eat the" : "You use the"} ${def.name.toLowerCase()}.`);
        },
        bag: (msg) => field.setBag(msg.bag),
        battleResult(msg) {
          field.onBattleResult(msg);
          const loot = describeItems(msg.loot);
          if (loot) ui.showToast(`You found ${loot}.`);
          const leftBehind = describeItems(msg.leftBehind);
          if (leftBehind) ui.showToast(`No room in your bag: you leave ${leftBehind} behind.`);
          const lost = describeItems(msg.lost);
          if (lost) ui.showToast(`Everything you carried is gone: ${lost}.`);
          if (!msg.accepted) ui.showToast("The server didn't accept that win.");
        },
      });
      setMode("field");
      engine.runRenderLoop(() => frame(frameSeconds(engine)));
      exposeDebugHandles({
        battle, field, ui, settings, mode: () => mode, encounter: () => net?.send({ t: "debug", cmd: "encounter" }),
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
      field.leave();
      ui.settingsScreen.set({ open: false });
      ui.creation.set({ open: false });
      ui.toasts.set({ items: [] });
      ui.screen.set({ fadeOpacity: 0 });
      setMode(null);
    },
  };
}

/** "boar meat" / "2 boar meat", or "" for nothing. */
function describeItems(items: ItemCounts): string {
  return (Object.entries(items) as [ItemId, number][])
    .map(([id, n]) => `${n > 1 ? `${n} ` : ""}${itemDef(id).name.toLowerCase()}`)
    .join(", ");
}
