import type { Entity, LevelLayout, Vec2 } from "@infinite-tower/shared";
import { OverworldActor, OverworldPos, type OverworldState } from "../modes/overworld/components.js";
import { waterMap } from "../modes/overworld/water.js";
import type { Cue, Heard } from "./battle.js";
import { nearestWater, type Hearing } from "./mix.js";
import { WATER_SOUNDS } from "./sounds.js";

export const OVERWORLD_HEARING: Hearing = { near: 1.5, far: 16 };
export const STRIDE_TILES = 0.9;
// Moved further than this in a frame: put there (a new level, a correction), not walked.
const JUMPED_TILES = 1.5;

interface Walked { last: Vec2; strideTiles: number }

export function overworldEars(): (state: OverworldState) => Heard | null {
  let heardLevel: LevelLayout | null = null, water: readonly Vec2[] = [];
  const walkers = new Map<Entity, Walked>();
  return ({ world, player, level, cameraTurns }) => {
    if (!level) return null;
    if (level !== heardLevel) [heardLevel, water] = [level, waterMap(level).tiles];
    const me = world.require(player, OverworldPos), cues: Cue[] = [], loops = new Map<string, Cue>();

    const seen = new Set<Entity>();
    for (const [e, actor, pos] of world.query(OverworldActor, OverworldPos)) {
      if (actor.kind !== "player" && actor.kind !== "peer") continue;
      seen.add(e);
      const was = walkers.get(e);
      const movedTiles = was ? Math.hypot(pos.x - was.last.x, pos.z - was.last.z) : 0;
      const strideTiles = (was?.strideTiles ?? 0) + (movedTiles < JUMPED_TILES ? movedTiles : 0);
      const walked = { last: { x: pos.x, z: pos.z }, strideTiles };
      if (walked.strideTiles >= STRIDE_TILES) {
        walked.strideTiles -= STRIDE_TILES;
        cues.push({ sound: "step-grass", at: walked.last });
      }
      walkers.set(e, walked);
    }
    for (const e of walkers.keys()) if (!seen.has(e)) walkers.delete(e);

    level.campfires.forEach((at, i) => loops.set(`campfire ${i}`, { sound: "campfire", at }));
    const wet = nearestWater(water, me);
    if (wet) loops.set("water", { sound: WATER_SOUNDS[level.theme], at: wet });
    return { ears: { x: me.x, z: me.z, yaw: (cameraTurns * Math.PI) / 2 }, hearing: OVERWORLD_HEARING, cues, loops };
  };
}
