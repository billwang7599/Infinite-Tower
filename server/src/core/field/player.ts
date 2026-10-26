/**
 * The field player on the server: replays the client's inputs with the shared walking rules
 * (authoritative) and rolls for encounters in tall grass.
 */
import { FIXED_DT, inTallGrass, stepWalker, type System, type Vec2, type World } from "@infinite-tower/shared";
import { rollEnemy } from "../levels/level.js";
import { FieldPlayer, FieldPos, type FieldPlayerData, type QueuedInput } from "./components.js";
import type { FieldContext } from "./context.js";

/** At most this many inputs banked: a client can catch up after lag, but not run faster. */
const MAX_CREDITS = 6;
/** Inputs waiting to be simulated; more than this and new ones are dropped. */
const MAX_QUEUED_INPUTS = 30;

export function queueInput(fp: FieldPlayerData, input: QueuedInput): void {
  if (fp.queue.length < MAX_QUEUED_INPUTS) fp.queue.push(input);
}

/** Where the player is, and whether enemies can engage them right now (safeTime after a battle). */
export function findPlayer(world: World): { pos: Vec2; safe: boolean } | null {
  const p = world.first(FieldPlayer, FieldPos);
  return p ? { pos: p[2], safe: p[1].safeTime > 0 } : null;
}

export function fieldPlayerSystem(ctx: FieldContext): System {
  return (world, dt) => {
    const { layout, grass } = ctx.level;
    for (const [, fp, pos] of world.query(FieldPlayer, FieldPos)) {
      fp.safeTime = Math.max(0, fp.safeTime - dt);
      fp.credits = Math.min(MAX_CREDITS, fp.credits + 1);
      while (fp.credits >= 1 && fp.queue.length > 0) {
        const input = fp.queue.shift()!;
        fp.credits--;
        fp.ack = input.seq;
        const x0 = pos.x, z0 = pos.z;
        stepWalker(layout, pos, input, FIXED_DT, { pace: fp.pace });
        if (!inTallGrass(layout, pos.x, pos.z)) continue;
        fp.grassDist += Math.hypot(pos.x - x0, pos.z - z0);
        while (fp.grassDist >= grass.stepDist) {
          fp.grassDist -= grass.stepDist;
          if (fp.safeTime <= 0 && ctx.rng() < grass.chance) {
            fp.queue.length = 0;
            ctx.startEncounter(null, rollEnemy(grass, ctx.rng));
            return;
          }
        }
      }
    }
  };
}
