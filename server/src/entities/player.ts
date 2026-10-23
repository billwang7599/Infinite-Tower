/**
 * The field player on the server: replays the client's inputs with the shared walking rules
 * (authoritative) and rolls for encounters in tall grass.
 */
import { FIXED_DT, inTallGrass, stepWalker, type System } from "@infinite-tower/shared";
import { rollEnemy } from "../levels/level.js";
import { FieldPlayer, FieldPos } from "./components.js";
import type { FieldContext } from "./context.js";

/** At most this many inputs banked: a client can catch up after lag, but not run faster. */
const MAX_CREDITS = 6;

export function fieldPlayerSystem(ctx: FieldContext): System {
  return (world, dt) => {
    const { layout, grass } = ctx.level;
    for (const [, fp, pos] of world.query(FieldPlayer, FieldPos)) {
      fp.safeTime = Math.max(0, fp.safeTime - dt);
      fp.credits = Math.min(MAX_CREDITS, fp.credits + 1);
      if (fp.queue.length === 0) { fp.vx = fp.vz = 0; continue; }

      while (fp.credits >= 1 && fp.queue.length > 0) {
        const input = fp.queue.shift()!;
        fp.credits--;
        fp.ack = input.seq;
        const ox = pos.x, oz = pos.z;
        const v = stepWalker(layout, pos, input, FIXED_DT);
        fp.vx = v.vx;
        fp.vz = v.vz;
        if (!inTallGrass(layout, pos.x, pos.z)) continue;
        fp.grassDist += Math.hypot(pos.x - ox, pos.z - oz);
        while (fp.grassDist >= grass.step) {
          fp.grassDist -= grass.step;
          if (fp.safeTime <= 0 && ctx.rng() < grass.chance) {
            fp.queue.length = 0;
            ctx.encounter(null, rollEnemy(grass, ctx.rng));
            return;
          }
        }
      }
    }
  };
}
