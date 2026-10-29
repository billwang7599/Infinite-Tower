import type { LevelLayout } from "@infinite-tower/shared";

export const TEST_LAYOUT: LevelLayout = {
  id: "test", name: "Test", floor: 1, theme: "grass-field", playerSpeed: 5,
  tiles: [
    "....................",
    ".......o............",
    ".......o............",
    ".......o............",
    '............""""....',
    '............""""....',
    "....................",
    "....................",
    "....................",
    "....................",
  ],
  campfires: [{ x: -5, z: 0 }],
};

/** The rock column in TEST_LAYOUT: x ∈ [-3, -2], z ∈ [1, 4]. */
export const ROCKS = { minX: -3, maxX: -2, minZ: 1, maxZ: 4 };

export function openTiles(width: number, depth: number): string[] {
  return Array.from({ length: depth }, () => ".".repeat(width));
}
