import { LocalPlayer, PlayerInput, type System } from "@infinite-tower/shared";
import { ACTIONS } from "../../settings/bindings.js";
import type { BattleContext } from "../context.js";

/** Mouse buttons are fixed (not rebindable), so they come straight from the action list. */
const ATTACK_BUTTONS = ACTIONS.battle.attack.mouse;
const DODGE_BUTTONS = ACTIONS.battle.dodge.mouse;

/**
 * Keyboard (+ optional mouse) -> PlayerInput for the local player. Remote players would get PlayerInput from the
 * network. Movement is camera-relative and the aim is the camera's facing, both converted to world space here, so
 * gameplay code never needs to know about the camera.
 */
export function playerInputSystem(ctx: BattleContext): System {
  const { keyboard, mouse } = ctx;
  return (world) => {
    const keys = ctx.settings.bindings.get().battle;
    const right = keyboard.axis(keys.left, keys.right);
    const forward = keyboard.axis(keys.back, keys.forward);
    const sin = Math.sin(ctx.view.yaw), cos = Math.cos(ctx.view.yaw);
    // Latched presses: a tap shorter than a tick still registers for one tick.
    const attackTap = keyboard.consumePressed(keys.attack) || mouse.consumePressed(ATTACK_BUTTONS);
    const dodgeTap = keyboard.consumePressed(keys.dodge) || mouse.consumePressed(DODGE_BUTTONS);
    for (const [, input] of world.query(PlayerInput, LocalPlayer)) {
      // Camera forward = (sin, cos), right = (cos, -sin).
      input.moveX = right * cos + forward * sin;
      input.moveZ = -right * sin + forward * cos;
      input.aimX = sin;
      input.aimZ = cos;
      input.jump = keyboard.isDown(keys.jump);
      input.attack = attackTap || keyboard.isDown(keys.attack) || mouse.isDown(ATTACK_BUTTONS);
      input.dodge = dodgeTap || keyboard.isDown(keys.dodge) || mouse.isDown(DODGE_BUTTONS);
    }
  };
}
