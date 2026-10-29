import type { LevelLayout } from "@infinite-tower/shared";
import type { Scenery } from "../overworld/scenery.js";
import type { SpriteDraw } from "../sprites.js";
import { GRASS_FIELD_TILES } from "./grass-field/tiles.js";
import { grassFieldScenery } from "./grass-field/scenery.js";
import type { TileLooks } from "./tiles.js";

interface LevelLook {
  tiles: TileLooks;
  scenery(level: LevelLayout): Scenery;
}

export const LEVEL_LOOKS: Record<LevelLayout["theme"], LevelLook> = {
  "grass-field": { tiles: GRASS_FIELD_TILES, scenery: grassFieldScenery },
};

export const FLICKER_TIME = 0.14;

const LOG = "#5a3a1e", LOG_HI = "#7a5230", STONE = "#7c7f86", STONE_DARK = "#5d6067";

/** A ring of stones, two crossed logs and a fire (24x24 pixels, sprites.ts). */
export function drawCampfire(frame: 0 | 1): SpriteDraw {
  return (px) => {
    for (const [x, y] of [[4, 17], [8, 19], [13, 19], [17, 17], [3, 13], [18, 13]] as const) {
      px(x, y, 3, 2, STONE); px(x, y + 1, 3, 1, STONE_DARK);
    }
    px(6, 15, 12, 2, LOG); px(6, 15, 12, 1, LOG_HI);   // logs
    px(9, 13, 2, 5, LOG); px(13, 13, 2, 5, LOG);
    const lean = frame === 0 ? 0 : 1;
    px(8, 9, 8, 6, "#e0482a");                         // flames, outside in
    px(9 + lean, 6, 6, 5, "#f07b2a");
    px(10, 3 + lean, 4, 5, "#f7b23b");
    px(11 - lean, 1, 2, 3, "#f7b23b");
    px(11, 8, 2, 5, "#ffe08a");
  };
}
