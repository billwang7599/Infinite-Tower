import type { WorldLayout } from "@infinite-tower/shared";

export const TEST_LAYOUT: WorldLayout = {
  bounds: { x: -10, z: -5, w: 20, h: 10 },
  regions: [
    { id: "west", name: "West", theme: "grass-field", area: { x: -10, z: -5, w: 10, h: 10 } },
    { id: "east", name: "East", theme: "mistwood", area: { x: 0, z: -5, w: 10, h: 10 } },
  ],
  playerSpeed: 5,
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
  npcs: [],
  traces: [], pads: [],
};

/** The rock column in TEST_LAYOUT: x ∈ [-3, -2], z ∈ [1, 4]. */
export const ROCKS = { minX: -3, maxX: -2, minZ: 1, maxZ: 4 };
