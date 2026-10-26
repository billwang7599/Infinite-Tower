/**
 * A level for tests, so they don't depend on the real levels' tuning. Walkable x ∈ [-18, 18], z ∈ [-8, 8].
 * The player starts at the left, the grass patch is in the middle, the campfire near the start, and one boar
 * spawns on the right, far from the player.
 */
import { DEFAULT_LOOK, type Character } from "@infinite-tower/shared";
import type { LevelDef } from "../../src/core/levels/level.js";

export const TEST_LEVEL: LevelDef = {
  layout: {
    id: "test-level", name: "Test Level", theme: "grass-field",
    halfWidth: 20, halfDepth: 10, border: 2, playerSpeed: 5,
    grass: [{ x: -2, z: -2, w: 4, h: 4 }],
    campfires: [{ x: -12, z: 0 }],
  },
  spawn: { x: -15, z: 0 },
  arena: { radius: 16 },
  spawns: [{ prefab: "boar", at: { x: 14, z: 5 }, respawnTime: 3 }],
  grass: { stepDist: 1, chance: 0.5, enemies: [{ enemy: "wild-boar", weight: 1 }] },
  safeTime: 2,
};

export const TEST_CHARACTER: Character = { name: "Tester", gender: "girl", look: DEFAULT_LOOK };
