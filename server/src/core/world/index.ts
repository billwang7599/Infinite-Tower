import type { ArenaDef, Rect, Vec2 } from "@infinite-tower/shared";
import { GRASS_FIELD_ARENA, KOBOLD_RUINS_ARENA, QUARRY_ARENA, WARLOCK_MIRE_ARENA } from "./arenas.js";
import type { Region } from "./region.js";
import { CASTLE_WARD } from "./regions/castle-ward.js";
import { GRASS_FIELD } from "./regions/grass-field.js";
import { MARKET_WARD } from "./regions/market-ward.js";
import { MISTWOOD } from "./regions/mistwood.js";
import { OLD_QUARRY } from "./regions/old-quarry.js";
import { WAKING_HOLLOW } from "./regions/waking-hollow.js";
import { ROADS } from "./roads.js";
import { composeWorld, toWorld } from "./world.js";

const DEFS = [CASTLE_WARD, MARKET_WARD, WAKING_HOLLOW, GRASS_FIELD, MISTWOOD, OLD_QUARRY];

export const WORLD = composeWorld(DEFS, ROADS);

export const ARENAS: Record<string, ArenaDef> = Object.fromEntries(
  [GRASS_FIELD_ARENA, KOBOLD_RUINS_ARENA, WARLOCK_MIRE_ARENA, QUARRY_ARENA].map((a) => [a.id, a]),
);

export const START_REGION = CASTLE_WARD.id;

/** Bound to a pad that's gone, or a region without one, you wake on the start region's. */
export function wakeRegion(pad: string): string {
  return WORLD.regions.find((r) => r.id === pad)?.hasPad ? pad : START_REGION;
}

export function getRegion(id: string): Region {
  const region = WORLD.regions.find((r) => r.id === id);
  if (!region) throw new Error(`Unknown region "${id}"`);
  return region;
}

export function inRegion(id: string, at: Vec2): Vec2 {
  const def = DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown region "${id}"`);
  return toWorld(def.origin, at);
}

export const regionRect = (id: string, area: Rect): Rect => ({ ...area, ...inRegion(id, area) });

export function getArena(id: string): ArenaDef {
  const arena = ARENAS[id];
  if (!arena) throw new Error(`Unknown arena "${id}"`);
  return arena;
}
