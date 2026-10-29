import type { ArenaDef } from "@infinite-tower/shared";
import { GRASS_FIELD, GRASS_FIELD_ARENA } from "./floors/1/grass-field.js";
import type { LevelDef } from "./level.js";

const LEVELS: Record<string, LevelDef> = {
  [GRASS_FIELD.layout.id]: GRASS_FIELD,
};

const ARENAS: Record<string, ArenaDef> = {
  [GRASS_FIELD_ARENA.id]: GRASS_FIELD_ARENA,
};

export const START_LEVEL = GRASS_FIELD.layout.id;

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
