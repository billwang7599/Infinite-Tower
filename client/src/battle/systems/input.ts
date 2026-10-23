import { LocalPlayer, PlayerInput, type System } from "@infinite-tower/shared";
import type { GameContext } from "../context.js";
import { KEYS } from "../keys.js";

/**
 * Keyboard -> PlayerInput for the local player. Remote players would get PlayerInput from the network.
 * Movement is camera-relative and the aim is the camera's facing, both converted to world space here,
 * so gameplay code never needs to know about the camera.
 */
export function inputSystem(ctx: GameContext): System {
  const k = ctx.keyboard;
  return (world) => {
    const right = k.axis(KEYS.left, KEYS.right);
    const forward = k.axis(KEYS.back, KEYS.forward);
    const s = Math.sin(ctx.view.yaw), c = Math.cos(ctx.view.yaw);
    // Latched presses: a tap shorter than a tick still registers for one tick.
    const attackTap = k.consumePressed(...KEYS.attack);
    const dodgeTap = k.consumePressed(...KEYS.dodge);
    for (const [, input] of world.query(PlayerInput, LocalPlayer)) {
      // Camera forward = (sin, cos), right = (cos, -sin).
      input.moveX = right * c + forward * s;
      input.moveZ = -right * s + forward * c;
      input.aimX = s;
      input.aimZ = c;
      input.jump = k.isDown(...KEYS.jump);
      input.attack = attackTap || k.isDown(...KEYS.attack);
      input.dodge = dodgeTap || k.isDown(...KEYS.dodge);
    }
  };
}
