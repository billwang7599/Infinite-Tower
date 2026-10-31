import type { ArenaDef } from "@infinite-tower/shared";
import { GRASS_FIELD_ARENA, KOBOLD_RUINS_ARENA, WARLOCK_MIRE_ARENA } from "./floors/1/arenas.js";
import { GRASS_FIELD } from "./floors/1/grass-field.js";
import { MISTWOOD } from "./floors/1/mistwood.js";
import { WAKING_HOLLOW } from "./floors/1/waking-hollow.js";
import type { LevelDef } from "./level.js";

export const LEVELS: Readonly<Record<string, LevelDef>> = Object.fromEntries(
  [WAKING_HOLLOW, GRASS_FIELD, MISTWOOD].map((l) => [l.layout.id, l]),
);

export const ARENAS: Record<string, ArenaDef> = Object.fromEntries(
  [GRASS_FIELD_ARENA, KOBOLD_RUINS_ARENA, WARLOCK_MIRE_ARENA].map((a) => [a.id, a]),
);

export const START_LEVEL = WAKING_HOLLOW.layout.id;

export const levelOrStart = (id: string | null): string => id !== null && Object.hasOwn(LEVELS, id) ? id : START_LEVEL;

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
