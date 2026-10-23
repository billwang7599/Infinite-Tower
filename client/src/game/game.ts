/**
 * Mode switching. Two modes, two Babylon scenes, one ECS world:
 * - field:  the 2D map (field/), its own fixed-step loop.
 * - battle: the 2.5D arena (battle/), stepped by Babylon's lockstep + Havok.
 * The server decides levels, encounters and fight results; this routes its messages (one handler per
 * message type) and runs the transitions:
 * an encounter flashes into battle, leaving a decided fight fades back to the field.
 */
import type { Engine } from "@babylonjs/core";
import type { ArenaDef, EnemyDef } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import type { Connection } from "../net/connection.js";
import { frameSeconds } from "../core/time.js";
import type { Field } from "../field/field.js";
import type { UiState } from "../ui/state.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

export interface Game {
  mode(): Mode;
  leaveBattle(): void;
  /** Must be called once both modes exist: starts the render loop. */
  run(battle: Battle, field: Field): void;
}

export function createGame(engine: Engine, keyboard: Keyboard, mouse: Mouse, ui: UiState, net: Connection): Game {
  let mode: Mode = "field";
  let transition: Transition | null = null;
  let encounter: { fromGrass: boolean; enemy: EnemyDef; arena: ArenaDef } | null = null;
  let battle: Battle, field: Field;

  const setMode = (m: Mode) => {
    mode = m;
    ui.screen.set({ mode: m });
    mouse.canLock = m === "battle";
    if (m === "field") mouse.unlock();
  };

  const swap = (to: Mode) => {
    if (to === "battle") {
      const { fromGrass, enemy, arena } = encounter!;
      battle.start(enemy, arena);
      ui.showToast(fromGrass ? `A ${enemy.name} leaps out of the grass!` : `The ${enemy.name} attacks!`);
    } else {
      net.send({ t: "battleEnd", won: battle.end() });
      field.awaitResult();
      keyboard.clearPressed();
    }
    setMode(to);
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
    } else {
      battle.render();
    }
  };

  return {
    mode: () => mode,
    leaveBattle() {
      if (mode !== "battle" || transition) return;
      transition = startTransition("field");
    },
    run(b, f) {
      battle = b;
      field = f;
      net.listen({
        level: (msg) => field.onLevel(msg),
        state: (msg) => field.onState(msg),
        encounter(msg) {
          field.onEncounter(msg);
          encounter = { fromGrass: msg.source === null, enemy: msg.enemy, arena: msg.arena };
          transition = startTransition("battle");
        },
        battleResult(msg) {
          field.onBattleResult(msg);
          if (!msg.accepted) ui.showToast("The server didn't accept that win.");
        },
      });
      net.onClose = () => ui.showToast("Lost connection to the server. Reload to reconnect.");
      setMode("field");
      engine.runRenderLoop(() => frame(frameSeconds(engine)));
    },
  };
}
