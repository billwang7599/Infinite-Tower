import type { WalkInput } from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";

/** Field bindings: WASD / arrows -> a walk input. Screen-aligned: up is +z. */
export function readWalkInput(keyboard: Keyboard): WalkInput {
  return {
    moveX: keyboard.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]),
    moveZ: keyboard.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]),
  };
}
