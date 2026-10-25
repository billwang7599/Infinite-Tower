import type { LevelLayout } from "@infinite-tower/shared";

/** A small level for tests: walkable x ∈ [-9, 9], z ∈ [-4, 4]; one grass patch and one campfire. */
export const TEST_LAYOUT: LevelLayout = {
  id: "test", name: "Test", theme: "grass-field",
  halfWidth: 10, halfDepth: 5, border: 1, playerSpeed: 5,
  grass: [{ x: 2, z: -1, w: 4, h: 2 }],
  campfires: [{ x: -5, z: 0 }],
};
