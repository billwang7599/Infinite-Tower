import type { ArenaDef } from "@infinite-tower/shared";
import { GRASS_FIELD_ARENA, KOBOLD_RUINS_ARENA, QUARRY_ARENA, WARLOCK_MIRE_ARENA } from "./floors/1/arenas.js";
import { GRASS_FIELD } from "./floors/1/grass-field.js";
import { MISTWOOD } from "./floors/1/mistwood.js";
import { OLD_QUARRY } from "./floors/1/old-quarry.js";
import { WAKING_HOLLOW } from "./floors/1/waking-hollow.js";
import { CASTLE_WARD } from "./highmere/castle-ward.js";
import { MARKET_WARD } from "./highmere/market-ward.js";
import type { LevelDef } from "./level.js";

export const LEVELS: Readonly<Record<string, LevelDef>> = Object.fromEntries(
  [CASTLE_WARD, MARKET_WARD, WAKING_HOLLOW, GRASS_FIELD, MISTWOOD, OLD_QUARRY].map((l) => [l.layout.id, l]),
);

export const ARENAS: Record<string, ArenaDef> = Object.fromEntries(
  [GRASS_FIELD_ARENA, KOBOLD_RUINS_ARENA, WARLOCK_MIRE_ARENA, QUARRY_ARENA].map((a) => [a.id, a]),
);

export const START_LEVEL = CASTLE_WARD.layout.id;

export function loginLevel(saved: string | null): string {
  const level = saved !== null && Object.hasOwn(LEVELS, saved) ? LEVELS[saved]! : getLevel(START_LEVEL);
  return level.wakeIn ?? level.layout.id;
}

export function getLevel(id: string): LevelDef {
  const level = LEVELS[id];
  if (!level) throw new Error(`Unknown level "${id}"`);
  return level;
}

export function getArena(id: string): ArenaDef {
  const arena = ARENAS[id];
  if (!arena) throw new Error(`Unknown arena "${id}"`);
  return arena;
}
