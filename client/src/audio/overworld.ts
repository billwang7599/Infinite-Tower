import { regionAt, type Entity, type Theme, type Vec2, type WorldMap } from "@infinite-tower/shared";
import { OverworldActor, OverworldPos, type OverworldState } from "../modes/overworld/components.js";
import { waterMap } from "../modes/overworld/water.js";
import type { Cue, Heard } from "./battle.js";
import { nearestWater, type Hearing } from "./mix.js";
import { RUNNING_WATER_SOUND, STILL_WATER_SOUNDS } from "./sounds.js";

export const OVERWORLD_HEARING: Hearing = { near: 1.5, far: 16 };
export const STRIDE_TILES = 0.9;
// Moved further than this in a frame: put there (a respawn, a correction), not walked.
const JUMPED_TILES = 1.5;

interface Walked { last: Vec2; strideTiles: number }

export function themeHere({ world, player, map }: OverworldState): Theme | null {
  const at = world.get(player, OverworldPos);
  return map && at ? regionAt(map, at.x, at.z).theme : null;
}

export function overworldEars(): (state: OverworldState) => Heard | null {
  let heardMap: WorldMap | null = null, running: readonly Vec2[] = [], still: readonly Vec2[] = [];
  const walkers = new Map<Entity, Walked>();
  return ({ world, player, map, cameraTurns }) => {
    if (!map) return null;
    if (map !== heardMap) ({ running, still } = waterMap(heardMap = map));
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

    map.campfires.forEach((at, i) => loops.set(`campfire ${i}`, { sound: "campfire", at }));
    const river = nearestWater(running, me), pool = nearestWater(still, me);
    const poolSound = pool && STILL_WATER_SOUNDS[regionAt(map, pool.x, pool.z).theme];
    if (river) loops.set("running water", { sound: RUNNING_WATER_SOUND, at: river });
    if (pool && poolSound) loops.set("still water", { sound: poolSound, at: pool });
    return { ears: { x: me.x, z: me.z, yaw: (cameraTurns * Math.PI) / 2 }, hearing: OVERWORLD_HEARING, cues, loops };
  };
}
