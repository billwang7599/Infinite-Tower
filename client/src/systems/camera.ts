import { Vector3 } from "@babylonjs/core";
import { LocalPlayer, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { GameContext } from "../context.js";

/** Fixed-angle 2.5D follow camera with exponential smoothing. Also carries the player's lantern light. */
export function cameraSystem(ctx: GameContext, lantern: { position: Vector3 }): System {
  const desired = new Vector3(), look = new Vector3(), lookTarget = new Vector3();
  let initialized = false;

  return (world, dt) => {
    const row = world.first(LocalPlayer, Body);
    if (!row) return;
    const p = row[2].mesh.position;

    // Look a bit upward: the player is always climbing.
    desired.set(p.x * 0.4, p.y + 4.5, p.z - 15);
    lookTarget.set(p.x * 0.6, p.y + 2.2, p.z);
    if (!initialized) {
      ctx.camera.position.copyFrom(desired);
      look.copyFrom(lookTarget);
      initialized = true;
    }
    const t = 1 - Math.exp(-5 * dt);
    Vector3.LerpToRef(ctx.camera.position, desired, t, ctx.camera.position);
    Vector3.LerpToRef(look, lookTarget, t * 1.4, look);
    ctx.camera.setTarget(look);

    lantern.position.set(p.x, p.y + 1.2, p.z - 1.2);
  };
}
