import { LocalPlayer, PlayerInput, type System } from "@infinite-tower/shared";
import type { GameContext } from "../context.js";

/**
 * Keyboard/mouse -> PlayerInput for the local player. Remote players would get PlayerInput from the network.
 * Movement is camera-relative and the aim is the camera's facing, both converted to world space here,
 * so gameplay code never needs to know about the camera.
 */
export function inputSystem(ctx: GameContext): System {
  const k = ctx.keyboard, m = ctx.mouse;
  return (world) => {
    const right = k.axis(["KeyA"], ["KeyD"]);
    const forward = k.axis(["KeyS"], ["KeyW"]);
    const s = Math.sin(ctx.view.yaw), c = Math.cos(ctx.view.yaw);
    // Latched presses: a tap shorter than a tick still registers for one tick.
    const attackTap = k.consumePressed("KeyJ") || m.consumePressed(0);
    const dodgeTap = k.consumePressed("ShiftLeft", "ShiftRight", "KeyL") || m.consumePressed(2);
    for (const [, input] of world.query(PlayerInput, LocalPlayer)) {
      // Camera forward = (sin, cos), right = (cos, -sin).
      input.moveX = right * c + forward * s;
      input.moveZ = -right * s + forward * c;
      input.aimX = s;
      input.aimZ = c;
      input.jump = k.isDown("Space");
      input.attack = attackTap || k.isDown("KeyJ") || m.isDown(0);
      input.dodge = dodgeTap || k.isDown("ShiftLeft", "ShiftRight", "KeyL") || m.isDown(2);
    }
  };
}
