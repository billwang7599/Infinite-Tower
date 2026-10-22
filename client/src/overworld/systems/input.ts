import { MapPlayer, PlayerInput, type System } from "@infinite-tower/shared";
import type { Keyboard } from "../../core/input.js";

/** WASD / arrows -> PlayerInput of the map player. Screen-aligned: up is +z. */
export function mapInputSystem(keyboard: Keyboard): System {
  return (world) => {
    for (const [, , input] of world.query(MapPlayer, PlayerInput)) {
      input.moveX = keyboard.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]);
      input.moveZ = keyboard.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]);
    }
  };
}
