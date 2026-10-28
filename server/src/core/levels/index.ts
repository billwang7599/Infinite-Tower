/** All levels by id. */
import type { LevelDef } from "./level.js";

const GRASS_FIELD: LevelDef = {
  layout: {
    id: "grass-field",
    name: "Grass Field",
    theme: "grass-field",
    halfWidth: 20,
    halfDepth: 13,
    border: 1.6,
    playerSpeed: 5,
    grass: [{ x: 3, z: 1, w: 11, h: 7 }],
    campfires: [{ x: -9, z: -2.5 }],
  },
  spawn: { x: -12, z: -5 },
  arena: { radius: 16 },
  spawns: [
    { enemy: "wild-boar", at: { x: 8, z: -6 }, respawnTime: 8 },
    // The Kobold Swordsman's own corner, away from the boar and the start.
    { enemy: "kobold-swordsman", at: { x: 16, z: -9 }, respawnTime: 12 },
    { enemy: "kobold-greatsword", at: { x: 16, z: 0 }, respawnTime: 12 },
    { enemy: "goblin-warlock", at: { x: -16, z: 9 }, respawnTime: 12 },
  ],
  grass: { stepDist: 1, chance: 0.12, enemies: [{ enemy: "wild-boar", weight: 1 }] },
  safeTime: 2,
};

const LEVELS: Record<string, LevelDef> = {
  [GRASS_FIELD.layout.id]: GRASS_FIELD,
};

export const START_LEVEL = GRASS_FIELD.layout.id;

export function getLevel(id: string): LevelDef {
  const level = LEVELS[id];
  if (!level) throw new Error(`Unknown level "${id}"`);
  return level;
}
