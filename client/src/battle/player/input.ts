import { LocalPlayer, PlayerInput, type System } from "@infinite-tower/shared";
import type { BattleContext } from "../context.js";
import { ACTIONS } from "../../settings/bindings.js";

/**
 * Keyboard (+ optional mouse) -> PlayerInput for the local player. Remote players would get PlayerInput from the network.
 * Movement is camera-relative and the aim is the camera's facing, both converted to world space here,
 * so gameplay code never needs to know about the camera.
 */
export function playerInputSystem(ctx: BattleContext): System {
  const k = ctx.keyboard, m = ctx.mouse;
  const { attack, dodge } = ACTIONS.battle;
  return (world) => {
    const keys = ctx.bindings.get().battle;
    const right = k.axis(keys.left, keys.right);
    const forward = k.axis(keys.back, keys.forward);
    const s = Math.sin(ctx.view.yaw), c = Math.cos(ctx.view.yaw);
    // Latched presses: a tap shorter than a tick still registers for one tick.
    const attackTap = k.consumePressed(...keys.attack) || m.consumePressed(...attack.mouse);
    const dodgeTap = k.consumePressed(...keys.dodge) || m.consumePressed(...dodge.mouse);
    for (const [, input] of world.query(PlayerInput, LocalPlayer)) {
      // Camera forward = (sin, cos), right = (cos, -sin).
      input.moveX = right * c + forward * s;
      input.moveZ = -right * s + forward * c;
      input.aimX = s;
      input.aimZ = c;
      input.jump = k.isDown(...keys.jump);
      input.attack = attackTap || k.isDown(...keys.attack) || m.isDown(...attack.mouse);
      input.dodge = dodgeTap || k.isDown(...keys.dodge) || m.isDown(...dodge.mouse);
    }
  };
}
