/**
 * Mode switching. Two modes, two Babylon scenes, one ECS world:
 * - map:    the 2D overworld (overworld/), its own fixed-step loop.
 * - battle: the 2.5D arena (battle/), stepped by Babylon's lockstep + Havok.
 * The server decides levels, encounters and fight results; this routes its messages (one handler per
 * message type) and runs the transitions:
 * an encounter flashes into battle, leaving a decided fight fades back to the map.
 */
import type { Engine } from "@babylonjs/core";
import type { ArenaDef, EnemyDef } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Keyboard } from "../core/input.js";
import type { Mouse } from "../core/mouse.js";
import type { Connection } from "../net/connection.js";
import type { Overworld } from "../overworld/overworld.js";
import type { Overlay } from "../ui/overlay.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

export interface Game {
  mode(): Mode;
  /** Battle -> map (the fight is decided). */
  leaveBattle(): void;
  /** Must be called once both modes exist: starts the render loop. */
  run(battle: Battle, overworld: Overworld): void;
}

export function createGame(engine: Engine, keyboard: Keyboard, mouse: Mouse, overlay: Overlay, net: Connection): Game {
  let mode: Mode = "map";
  let transition: Transition | null = null;
  let encounter: { fromGrass: boolean; enemy: EnemyDef; arena: ArenaDef } | null = null;
  let battle: Battle, overworld: Overworld;

  const setMode = (m: Mode) => {
    mode = m;
    overlay.setMode(m);
    mouse.canLock = m === "battle";
    if (m === "map") mouse.release();
  };

  const swap = (to: Mode) => {
    if (to === "battle") {
      const { fromGrass, enemy, arena } = encounter!;
      battle.start(enemy, arena);
      overlay.toast(fromGrass ? `A ${enemy.name} leaps out of the grass!` : `The ${enemy.name} attacks!`);
    } else {
      net.send({ t: "battleEnd", won: battle.end() });
      overworld.awaitResult();
      keyboard.clearPressed();
    }
    setMode(to);
  };

  const frame = (dt: number) => {
    if (transition) {
      const f = stepTransition(transition, dt);
      overlay.setFade(f.color, f.opacity);
      if (f.swapNow) swap(transition.to);
      if (f.done) transition = null;
    }
    if (mode === "map") {
      overworld.update(dt, transition !== null);
      overworld.render();
    } else {
      battle.render();
    }
  };

  return {
    mode: () => mode,
    leaveBattle() {
      if (mode !== "battle" || transition) return;
      transition = startTransition("map");
    },
    run(b, o) {
      battle = b;
      overworld = o;
      net.listen({
        level: (msg) => overworld.onLevel(msg),
        state: (msg) => overworld.onState(msg),
        encounter(msg) {
          overworld.onEncounter(msg);
          encounter = { fromGrass: msg.source === null, enemy: msg.enemy, arena: msg.arena };
          transition = startTransition("battle");
        },
        battleResult(msg) {
          overworld.onBattleResult(msg);
          if (!msg.accepted) overlay.toast("The server didn't accept that win.");
        },
      });
      net.onClose = () => overlay.toast("Lost connection to the server. Reload to reconnect.");
      setMode("map");
      engine.runRenderLoop(() => frame(Math.min(engine.getDeltaTime() / 1000, 0.1)));
    },
  };
}
