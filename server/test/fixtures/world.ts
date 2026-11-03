/**
 * A world for tests, so they don't depend on the real regions' tuning: one region, an open 40 x 20 field,
 * x ∈ [-20, 20], z ∈ [-10, 10], walled in by trees. The player starts at the left, the grass patch (x, z ∈ [-2, 2])
 * is in the middle, the campfire near the start, and one boar spawns on the right, far from the player.
 */
import { DEFAULT_LOOK, type Character } from "@infinite-tower/shared";
import type { RegionDef } from "../../src/core/world/region.js";
import { composeWorld } from "../../src/core/world/world.js";

export const TEST_REGION: RegionDef = {
  id: "test-region", name: "Test Region", theme: "grass-field", origin: { x: 0, z: 0 }, fill: "T",
  tiles: Array.from({ length: 20 }, (_, row) =>
    row >= 8 && row < 12 ? `${".".repeat(18)}""""${".".repeat(18)}` : ".".repeat(40)),
  campfires: [{ x: -12, z: 0 }],
  spawn: { x: -15, z: 0 },
  arenaId: "grass-field",
  duelArenaId: "kobold-ruins",
  spawns: [{ enemy: "wild-boar", at: { x: 14, z: 5 }, respawnTime: 3 }],
  grass: { stepDist: 1, chance: 0.5, enemies: [{ enemy: "wild-boar", weight: 1 }] },
};

export const testWorld = (changes: Partial<RegionDef> = {}) => composeWorld([{ ...TEST_REGION, ...changes }]);

export const TEST_WORLD = testWorld();

/** The tall-grass patch in TEST_WORLD. */
export const TEST_GRASS = { x: -2, z: -2, w: 4, h: 4 };

export const TEST_CHARACTER: Character = { name: "Tester", gender: "girl", look: DEFAULT_LOOK };

export const TEST_HALF = { halfWidth: 20, halfDepth: 10 };
