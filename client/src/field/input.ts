import type { WalkInput } from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import type { KeyMap } from "../settings/bindings.js";

/** The field's walk keys -> a walk input. Screen-aligned: up is +z. */
export function readWalkInput(keyboard: Keyboard, keys: KeyMap["field"]): WalkInput {
  return {
    moveX: keyboard.axis(keys.left, keys.right),
    moveZ: keyboard.axis(keys.down, keys.up),
  };
}
