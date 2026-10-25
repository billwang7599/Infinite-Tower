/** Applies each actor's velocity, keeps it inside the level, and turns it the way it's walking. */
import { clampToLevel, type System } from "@infinite-tower/shared";
import { FieldActor, FieldPos, type FieldActorData } from "../components.js";
import type { FieldContext } from "../context.js";

/** Set the actor walking along (dx, dz), `dist` long, at `speed` tiles/s. */
export function steerToward(actor: FieldActorData, dx: number, dz: number, dist: number, speed: number): void {
  actor.vx = (dx / dist) * speed;
  actor.vz = (dz / dist) * speed;
}

/** Turn the sprite toward +x or -x, unless `dx` is too small to tell. */
export function faceToward(actor: FieldActorData, dx: number): void {
  if (Math.abs(dx) > 0.1) actor.facing = dx > 0 ? 1 : -1;
}

export function moveSystem(ctx: FieldContext): System {
  return (world, dt) => {
    for (const [, pos, actor] of world.query(FieldPos, FieldActor)) {
      pos.x += actor.vx * dt;
      pos.z += actor.vz * dt;
      clampToLevel(ctx.level.layout, pos);
      faceToward(actor, actor.vx);
    }
  };
}
