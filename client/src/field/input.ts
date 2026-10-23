import type { WalkInput } from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";

/** Field bindings (KeyboardEvent.code). Screen-aligned: up is +z. The title's controls page lists these. */
export const FIELD_KEYS = {
  up: ["KeyW", "ArrowUp"],
  left: ["KeyA", "ArrowLeft"],
  down: ["KeyS", "ArrowDown"],
  right: ["KeyD", "ArrowRight"],
} as const satisfies Record<string, readonly string[]>;

export function readWalkInput(keyboard: Keyboard): WalkInput {
  return {
    moveX: keyboard.axis(FIELD_KEYS.left, FIELD_KEYS.right),
    moveZ: keyboard.axis(FIELD_KEYS.down, FIELD_KEYS.up),
  };
}
