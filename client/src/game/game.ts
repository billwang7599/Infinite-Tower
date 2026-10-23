/**
 * Mode switching and sessions. Two modes, two Babylon scenes, one ECS world:
 * - field:  the 2D map (field/), its own fixed-step loop.
 * - battle: the 2.5D arena (battle/), stepped by Babylon's lockstep + Havok.
 * Everything is built once. A session (join -> leave) is one connection to the server, which decides levels,
 * encounters and fight results; this routes its messages (one handler per message type) and runs the
 * transitions: an encounter flashes into battle, leaving a decided fight fades back to the field.
 */
import type { Engine } from "@babylonjs/core";
import { itemDef, type ArenaDef, type Character, type EnemyDef, type Inventory, type ItemId, type Stats, type Vitals } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import type { Connection, Joined } from "../net/connection.js";
import { frameSeconds } from "../core/time.js";
import type { Field } from "../field/field.js";
import type { UiState } from "../ui/state.js";
import { dressPlayer } from "./dress.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

export interface Game {
  /** null outside a session. */
  mode(): Mode | null;
  /** Called once, after both modes exist (the battle needs `leaveBattle` first). */
  setModes(battle: Battle, field: Field): void;
  /** Start a session on a connection the server has welcomed. `onLost` runs if it drops. */
  join(joined: Joined, onLost: (closeCode: number) => void): void;
  /** End the session: hang up, stop drawing, forget the level and any fight. */
  leave(): void;
  leaveBattle(): void;
  rest(): void;
  useItem(item: ItemId): void;
  /** Ask the server to save a new name / look (it answers with `character`). */
  saveCharacter(character: Character): void;
}

export function createGame(engine: Engine, keyboard: Keyboard, mouse: Mouse, ui: UiState): Game {
  let mode: Mode | null = null;
  let net: Connection | null = null;
  let transition: Transition | null = null;
  let encounter: { fromGrass: boolean; enemy: EnemyDef; arena: ArenaDef; vitals: Vitals; stats: Stats } | null = null;
  let battle: Battle, field: Field;

  /** The game only gets input during a session with no screen over it, and the mouse only in the arena. */
  const updateInput = () => {
    const playing = mode !== null && !ui.settingsScreen.get().open && !ui.characterScreen.get().open;
    keyboard.enabled = playing;
    mouse.canLock = playing && mode === "battle";
    if (!mouse.canLock) mouse.unlock();
  };
  ui.settingsScreen.subscribe(updateInput);
  ui.characterScreen.subscribe(updateInput);
  updateInput();

  const setMode = (m: Mode | null) => {
    mode = m;
    ui.screen.set({ mode: m });
    updateInput();
  };

  const swap = (to: Mode) => {
    if (to === "battle") {
      const { fromGrass, enemy, arena, vitals, stats } = encounter!;
      battle.start(enemy, arena, vitals, stats);
      ui.showToast(fromGrass ? `A ${enemy.name} leaps out of the grass!` : `The ${enemy.name} attacks!`);
    } else {
      net?.send({ t: "battleEnd", ...battle.end() });
      field.awaitResult();
      keyboard.clearPressed();
    }
    setMode(to);
  };

  /** No character yet: the editor opens, and the server holds the level back until one is saved. */
  const applyCharacter = (character: Character | null) => {
    ui.field.set({ character });
    if (character) {
      dressPlayer(battle, field, character.look);
      ui.characterScreen.set({ open: false, firstTime: false });
    } else {
      ui.characterScreen.set({ open: true, firstTime: true });
    }
  };

  const frame = (dt: number) => {
    if (transition) {
      const f = stepTransition(transition, dt);
      ui.screen.set({ fadeColor: f.color, fadeOpacity: f.opacity });
      if (f.swapNow) swap(transition.to);
      if (f.done) transition = null;
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
    useItem(item) {
      if (mode === "field" && !transition) net?.send({ t: "useItem", item });
    },
    saveCharacter(character) {
      net?.send({ t: "character", character });
    },
    setModes(b, f) {
      battle = b;
      field = f;
    },
    join(joined, onLost) {
      net = joined.net;
      net.listen({
        level: (msg) => field.onLevel(msg),
        state: (msg) => field.onState(msg),
        encounter(msg) {
          field.onEncounter(msg);
          encounter = { fromGrass: msg.source === null, enemy: msg.enemy, arena: msg.arena, vitals: msg.vitals, stats: msg.stats };
          transition = startTransition("battle");
        },
        character: (msg) => applyCharacter(msg.character),
        rested(msg) {
          field.onRested(msg);
          ui.showToast("You rest by the fire. HP and stamina are restored.");
        },
        itemUsed(msg) {
          field.onItemUsed(msg);
          ui.field.set({ inventory: msg.inventory });
          const def = itemDef(msg.item);
          ui.showToast(`${def.verb === "Eat" ? "You eat the" : "You use the"} ${def.name.toLowerCase()}.`);
        },
        battleResult(msg) {
          field.onBattleResult(msg);
          ui.field.set({ inventory: msg.inventory });
          const loot = describe(msg.loot);
          if (loot) ui.showToast(`You found ${loot}.`);
          if (!msg.accepted) ui.showToast("The server didn't accept that win.");
        },
      });
      net.onClose = onLost;
      field.join(net, joined.welcome);
      applyCharacter(joined.welcome.character);
      ui.field.set({ inventory: joined.welcome.inventory });
      setMode("field");
      engine.runRenderLoop(() => frame(frameSeconds(engine)));
    },
    leave() {
      if (!net) return;
      engine.stopRenderLoop();
      net.close();
      net = null;
      if (mode === "battle") battle.end();
      transition = encounter = null;
      field.leave();
      ui.settingsScreen.set({ open: false });
      ui.characterScreen.set({ open: false, firstTime: false });
      ui.toasts.set({ items: [] });
      ui.screen.set({ fadeOpacity: 0 });
      setMode(null);
    },
  };
}

/** "boar meat" / "2 boar meat", or "" for nothing. */
function describe(items: Inventory): string {
  return (Object.entries(items) as [ItemId, number][])
    .map(([id, n]) => `${n > 1 ? `${n} ` : ""}${itemDef(id).name.toLowerCase()}`)
    .join(", ");
}
