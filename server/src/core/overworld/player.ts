/** The overworld player: replays the client's inputs with the shared walking rules, and rolls for encounters. */
import { FIXED_DT, inTallGrass, stepWalker, type System, type Vec2, type World } from "@infinite-tower/shared";
import { rollEnemy } from "../world/level.js";
import { OverworldPlayer, OverworldPos, type OverworldPlayerData, type QueuedInput } from "./components.js";
import type { OverworldContext } from "./context.js";

/** At most this many inputs banked: a client can catch up after lag, but not run faster. */
const MAX_CREDITS = 6;
/** Inputs waiting to be simulated; more than this and new ones are dropped. */
const MAX_QUEUED_INPUTS = 30;

export function queueInput(walk: OverworldPlayerData, input: QueuedInput): void {
  if (walk.queue.length < MAX_QUEUED_INPUTS) walk.queue.push(input);
}

/** `safe`: enemies can't engage them right now (just after a battle). */
export function findPlayer(world: World): { pos: Vec2; safe: boolean } | null {
  const p = world.first(OverworldPlayer, OverworldPos);
  return p ? { pos: p[2], safe: p[1].safeTime > 0 } : null;
}

export function overworldPlayerSystem(ctx: OverworldContext): System {
  return (world, dt) => {
    const { layout, grass } = ctx.level;
    for (const [, walk, pos] of world.query(OverworldPlayer, OverworldPos)) {
      walk.safeTime = Math.max(0, walk.safeTime - dt);
      walk.credits = Math.min(MAX_CREDITS, walk.credits + 1);
      while (walk.credits >= 1 && walk.queue.length > 0) {
        const input = walk.queue.shift()!;
        walk.credits--;
        walk.ack = input.seq;
        const x0 = pos.x, z0 = pos.z;
        stepWalker(layout, pos, input, FIXED_DT, { pace: walk.pace });
        if (!inTallGrass(layout, pos.x, pos.z)) continue;
        walk.grassDist += Math.hypot(pos.x - x0, pos.z - z0);
        while (walk.grassDist >= grass.stepDist) {
          walk.grassDist -= grass.stepDist;
          if (walk.safeTime <= 0 && ctx.rng() < grass.chance) {
            walk.queue.length = 0;
            ctx.startEncounter(null, rollEnemy(grass, ctx.rng));
            return;
          }
        }
      }
    }
  };
}
