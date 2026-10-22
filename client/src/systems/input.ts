import { LocalPlayer, PlayerInput, type System } from "@infinite-tower/shared";
import type { GameContext } from "../context.js";

/**
 * Keyboard -> PlayerInput for the local player. Remote players get PlayerInput from the network instead.
 * WASD is camera-relative; PlayerInput.moveX/moveZ are world-space, so movement code never needs the camera.
 * (Arrow keys orbit the camera, see cameraSystem.)
 */
export function inputSystem(ctx: GameContext): System {
  const k = ctx.keyboard;
  return (world) => {
    const right = k.axis(["KeyA"], ["KeyD"]);
    const forward = k.axis(["KeyS"], ["KeyW"]);
    const c = Math.cos(ctx.view.yaw), s = Math.sin(ctx.view.yaw);
    for (const [, input] of world.query(PlayerInput, LocalPlayer)) {
      // Camera right = (cos, 0, sin), camera forward = (-sin, 0, cos).
      input.moveX = right * c - forward * s;
      input.moveZ = right * s + forward * c;
      input.jump = k.isDown("Space", "KeyK");
    }
  };
}
