import { VIEWS } from "@infinite-tower/client/src/gfx/look/art.js";
import { PX_PER_TILE } from "@infinite-tower/client/src/gfx/tile.js";
import { PARTS } from "./layers.js";

export const MODES = ["sprite", "tiles"] as const;
export type Mode = (typeof MODES)[number];

type Size = { width: number; height: number };

export const MODE_LOOKS: Record<Mode, { label: string; page: string; sizes: Record<string, Size>; layers: readonly string[] }> = {
  sprite: { label: "Sprite", page: "", sizes: { ...VIEWS }, layers: PARTS },
  tiles: {
    label: "Tiles", page: "tile",
    sizes: { tile: { width: PX_PER_TILE, height: PX_PER_TILE } },
    layers: ["ground", "detail"],
  },
};
