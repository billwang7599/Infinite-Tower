/**
 * Mode switching. Two modes, two Babylon scenes, one ECS world:
 * - map:    the 2D overworld (overworld/), its own fixed-step loop.
 * - battle: the 2.5D arena (battle/), stepped by Babylon's lockstep + Havok.
 * An encounter on the map flashes into battle; leaving a decided fight fades back to the map.
 */
import type { Engine } from "@babylonjs/core";
import type { Entity } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Keyboard, Mouse } from "../core/input.js";
import type { Overworld } from "../overworld/overworld.js";
import type { Overlay } from "../ui/overlay.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

export interface Game {
  mode(): Mode;
  /** Map -> battle. `source` is the map boar that touched you (null: tall grass). */
  encounter(source: Entity | null): void;
  /** Battle -> map (the fight is decided). */
  leaveBattle(): void;
  /** Must be called once both modes exist: starts the render loop. */
  run(battle: Battle, overworld: Overworld): void;
}

export function createGame(engine: Engine, keyboard: Keyboard, mouse: Mouse, overlay: Overlay): Game {
  let mode: Mode = "map";
  let transition: Transition | null = null;
  let encounterSource: Entity | null = null;
  let battle: Battle, overworld: Overworld;

  const setMode = (m: Mode) => {
    mode = m;
    overlay.setMode(m);
    mouse.canLock = m === "battle";
    if (m === "map") mouse.release();
  };

  const swap = (to: Mode) => {
    if (to === "battle") {
      battle.start();
      overlay.toast(encounterSource === null ? "A Wild Boar leaps out of the grass!" : "The Wild Boar attacks!");
    } else {
      overworld.returnFromFight(battle.end(), encounterSource);
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
    encounter(source) {
      if (mode !== "map" || transition) return;
      encounterSource = source;
      transition = startTransition("battle");
    },
    leaveBattle() {
      if (mode !== "battle" || transition) return;
      transition = startTransition("map");
    },
    run(b, o) {
      battle = b;
      overworld = o;
      setMode("map");
      engine.runRenderLoop(() => frame(Math.min(engine.getDeltaTime() / 1000, 0.1)));
    },
  };
}
