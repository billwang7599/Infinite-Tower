/** Applies each actor's velocity by the shared walking rule, and turns it the way it's walking. */
import { moveWalker, type System } from "@infinite-tower/shared";
import { OverworldActor, OverworldPos, type OverworldActorData } from "../components.js";
import type { OverworldContext } from "../context.js";
import { Asleep } from "../sleep.js";

/** Set the actor walking along (dx, dz), `dist` long, at `speed` tiles/s. */
export function steerToward(actor: OverworldActorData, dx: number, dz: number, dist: number, speed: number): void {
  actor.vx = (dx / dist) * speed;
  actor.vz = (dz / dist) * speed;
}

/** Turn the sprite toward +x or -x, unless `dx` is too small to tell. */
export function faceToward(actor: OverworldActorData, dx: number): void {
  if (Math.abs(dx) > 0.1) actor.facing = dx > 0 ? 1 : -1;
}

export function moveSystem(ctx: OverworldContext): System {
  return (world, dt) => {
    for (const [e, pos, actor] of world.query(OverworldPos, OverworldActor)) {
      if (world.has(e, Asleep)) continue;
      moveWalker(ctx.map.layout, pos, actor.vx * dt, actor.vz * dt);
      faceToward(actor, actor.vx);
    }
  };
}
