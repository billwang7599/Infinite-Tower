/** All levels by id. New level: add a file next to grass-field.ts and list it here. */
import { GRASS_FIELD } from "./grass-field.js";
import type { LevelDef } from "./level.js";

const LEVELS: Record<string, LevelDef> = {
  [GRASS_FIELD.layout.id]: GRASS_FIELD,
};

export const START_LEVEL = GRASS_FIELD.layout.id;

export function getLevel(id: string): LevelDef {
  const level = LEVELS[id];
  if (!level) throw new Error(`Unknown level "${id}"`);
  return level;
}
