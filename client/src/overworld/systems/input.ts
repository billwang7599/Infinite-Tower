import type { WalkInput } from "@infinite-tower/shared";
import type { Keyboard } from "../../core/input.js";

/** WASD / arrows -> a walk input. Screen-aligned: up is +z. */
export function readMapInput(keyboard: Keyboard): WalkInput {
  return {
    moveX: keyboard.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]),
    moveZ: keyboard.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]),
  };
}
