import { LocalPlayer, PlayerInput, type System } from "@infinite-tower/shared";
import type { GameContext } from "../context.js";

/** Keyboard -> PlayerInput for the local player. Remote players get PlayerInput from the network instead. */
export function inputSystem(ctx: GameContext): System {
  const k = ctx.keyboard;
  return (world) => {
    for (const [, input] of world.query(PlayerInput, LocalPlayer)) {
      input.moveX = k.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]);
      input.moveZ = k.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]);
      input.jump = k.isDown("Space", "KeyK");
    }
  };
}
