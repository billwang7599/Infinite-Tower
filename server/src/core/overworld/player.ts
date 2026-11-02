/** The overworld player: replays the client's inputs with the shared walking rules, and rolls for encounters. */
import {
  distXZ, faceToward, FIXED_DT, inTallGrass, START_HEADING, stepWalker, type Character, type System, type Vec2,
  type World,
} from "@infinite-tower/shared";
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

export function newWalk(character: Character, pad: string): OverworldPlayerData {
  return {
    character, queue: [], lastSeq: 0, credits: 0, ack: 0, grassDist: 0, safeTime: 0, pace: 1, vx: 0, vz: 0,
    heading: START_HEADING, fighting: false, pad,
  };
}

export const huntable = (walk: OverworldPlayerData): boolean => !walk.fighting && walk.safeTime <= 0;

export function nearestHuntablePlayer(world: World, at: Vec2): { pos: Vec2; dist: number } | null {
  let nearest: { pos: Vec2; dist: number } | null = null;
  for (const [, walk, pos] of world.query(OverworldPlayer, OverworldPos)) {
    if (!huntable(walk)) continue;
    const dist = distXZ(at, pos);
    if (!nearest || dist < nearest.dist) nearest = { pos, dist };
  }
  return nearest;
}

export function overworldPlayerSystem(ctx: OverworldContext): System {
  return (world, dt) => {
    const { layout, grass } = ctx.level;
    for (const [player, walk, pos] of world.query(OverworldPlayer, OverworldPos)) {
      if (walk.fighting) continue;
      walk.safeTime = Math.max(0, walk.safeTime - dt);
      walk.credits = Math.min(MAX_CREDITS, walk.credits + 1);
      // Full credits: no input for MAX_CREDITS ticks, so they've stopped (a tick or two without one is jitter).
      if (walk.credits === MAX_CREDITS) walk.vx = walk.vz = 0;
      while (walk.credits >= 1 && walk.queue.length > 0 && !walk.fighting) {
        const input = walk.queue.shift()!;
        walk.credits--;
        walk.ack = input.seq;
        const x0 = pos.x, z0 = pos.z;
        stepWalker(layout, pos, input, FIXED_DT, { pace: walk.pace, vel: walk });
        walk.heading = faceToward(walk.heading, input.moveX, input.moveZ);
        if (!grass || !inTallGrass(layout, pos.x, pos.z)) continue;
        walk.grassDist += Math.hypot(pos.x - x0, pos.z - z0);
        while (walk.grassDist >= grass.stepDist) {
          walk.grassDist -= grass.stepDist;
          if (walk.safeTime <= 0 && ctx.rng() < grass.chance) {
            ctx.startEncounter(player, null, rollEnemy(grass, ctx.rng));
            break;
          }
        }
      }
    }
  };
}
