/** Applies each actor's velocity, keeps it inside the level, and turns it the way it's walking. */
import { clampToLevel, type System } from "@infinite-tower/shared";
import { FieldActor, FieldPos } from "../components.js";
import type { FieldContext } from "../context.js";

export function moveSystem(ctx: FieldContext): System {
  return (world, dt) => {
    for (const [, pos, actor] of world.query(FieldPos, FieldActor)) {
      pos.x += actor.vx * dt;
      pos.z += actor.vz * dt;
      clampToLevel(ctx.level.layout, pos);
      if (Math.abs(actor.vx) > 0.1) actor.facing = actor.vx > 0 ? 1 : -1;
    }
  };
}
