/**
 * A level for tests, so they don't depend on the real levels' tuning: an open 40 x 20 field, x ∈ [-20, 20],
 * z ∈ [-10, 10]. The player starts at the left, the grass patch (x, z ∈ [-2, 2]) is in the middle, the campfire
 * near the start, and one boar spawns on the right, far from the player.
 */
import { DEFAULT_LOOK, type Character } from "@infinite-tower/shared";
import type { LevelDef } from "../../src/core/world/level.js";

export const TEST_LEVEL: LevelDef = {
  layout: {
    id: "test-level", name: "Test Level", floor: 1, theme: "grass-field", playerSpeed: 5,
    tiles: Array.from({ length: 20 }, (_, row) =>
      row >= 8 && row < 12 ? `${".".repeat(18)}""""${".".repeat(18)}` : ".".repeat(40)),
    campfires: [{ x: -12, z: 0 }],
  },
  spawn: { x: -15, z: 0 },
  arenaId: "grass-field",
  spawns: [{ enemy: "wild-boar", at: { x: 14, z: 5 }, respawnTime: 3 }],
  grass: { stepDist: 1, chance: 0.5, enemies: [{ enemy: "wild-boar", weight: 1 }] },
  safeTime: 2,
};

/** The tall-grass patch in TEST_LEVEL. */
export const TEST_GRASS = { x: -2, z: -2, w: 4, h: 4 };

export const TEST_CHARACTER: Character = { name: "Tester", gender: "girl", look: DEFAULT_LOOK };
