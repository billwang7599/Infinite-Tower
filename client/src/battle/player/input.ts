import type { PlayerInputData } from "@infinite-tower/shared";
import type { BattleContext } from "../context.js";

/**
 * Keyboard (+ optional mouse) -> the local player's input for the next step of the fight. Movement is
 * camera-relative and the aim is the camera's facing, both converted to world space here, so the fight never needs
 * to know about the camera.
 */
export function readPlayerInput({ actions, view }: BattleContext, input: PlayerInputData): void {
  const right = actions.axis("battle", "left", "right");
  const forward = actions.axis("battle", "back", "forward");
  const sin = Math.sin(view.yaw), cos = Math.cos(view.yaw);
  // Camera forward = (sin, cos), right = (cos, -sin).
  input.moveX = right * cos + forward * sin;
  input.moveZ = -right * sin + forward * cos;
  input.aimX = sin;
  input.aimZ = cos;
  input.jump = actions.isDown("battle", "jump");
  input.attack = actions.attack();
  // A tap shorter than a step still dodges.
  input.dodge = actions.consumePressed("battle", "dodge") || actions.isDown("battle", "dodge");
  input.block = actions.isDown("battle", "block");
}
