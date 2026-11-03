import { Color3 } from "@babylonjs/core";
import { regionAt, type Theme, type WorldMap } from "@infinite-tower/shared";
import type { MapLight, SkyLook } from "../sky/sky.js";
import type { SpriteDraw } from "../sprites.js";
import type { WaterLook } from "../water/water.js";
import { GRASS_FIELD_TILES } from "./grass-field/tiles.js";
import { KINGDOM_TILES } from "./kingdom/tiles.js";
import { MISTWOOD_TILES } from "./mistwood/tiles.js";
import { QUARRY_TILES } from "./quarry/tiles.js";
import type { LooksAt, TileLooks } from "./tiles.js";

interface RegionLook {
  env: SkyLook;
  tiles: TileLooks;
  water: WaterLook;
}

export const REGION_LOOKS: Record<Theme, RegionLook> = {
  "grass-field": {
    env: {
      sky: new Color3(0.27, 0.25, 0.29),
      fogDensity: 0.016,
      ambient: new Color3(0.26, 0.24, 0.3),
      skyLight: { color: new Color3(0.55, 0.58, 0.82), ground: new Color3(0.32, 0.26, 0.22), intensity: 0.5 },
      sun: { color: new Color3(1, 0.68, 0.46), intensity: 1.5 },
    },
    tiles: GRASS_FIELD_TILES,
    water: {
      body: new Color3(0.08, 0.22, 0.25),
      murkPerTile: 1.8,
      reflectivity: 0.12,
      glint: new Color3(1.6, 1.5, 1.35),
      rippleSlope: 0.55,
      waveHeightTiles: 0.025,
      foam: new Color3(0.62, 0.68, 0.66),
      foamTiles: 0.12,
    },
  },
  mistwood: {
    env: {
      sky: new Color3(0.2, 0.23, 0.24),
      fogDensity: 0.034,
      ambient: new Color3(0.17, 0.2, 0.21),
      skyLight: { color: new Color3(0.45, 0.58, 0.62), ground: new Color3(0.15, 0.16, 0.12), intensity: 0.45 },
      sun: { color: new Color3(0.86, 0.8, 0.7), intensity: 1.05 },
    },
    tiles: MISTWOOD_TILES,
    water: {
      body: new Color3(0.05, 0.08, 0.05),
      murkPerTile: 4,
      reflectivity: 0.16,
      glint: new Color3(1.1, 1.1, 1),
      rippleSlope: 0.2,
      waveHeightTiles: 0.008,
      foam: new Color3(0.36, 0.4, 0.28),
      foamTiles: 0.1,
    },
  },
  kingdom: {
    env: {
      sky: new Color3(0.29, 0.26, 0.3),
      fogDensity: 0.012,
      ambient: new Color3(0.3, 0.27, 0.31),
      skyLight: { color: new Color3(0.6, 0.6, 0.8), ground: new Color3(0.36, 0.3, 0.25), intensity: 0.55 },
      sun: { color: new Color3(1, 0.72, 0.5), intensity: 1.5 },
    },
    tiles: KINGDOM_TILES,
    water: {
      body: new Color3(0.07, 0.2, 0.26),
      murkPerTile: 1.2,
      reflectivity: 0.18,
      glint: new Color3(1.6, 1.5, 1.35),
      rippleSlope: 0.4,
      waveHeightTiles: 0.01,
      foam: new Color3(0.7, 0.74, 0.74),
      foamTiles: 0.08,
    },
  },
  quarry: {
    env: {
      sky: new Color3(0.4, 0.37, 0.33),
      fogDensity: 0.024,
      ambient: new Color3(0.33, 0.31, 0.29),
      skyLight: { color: new Color3(0.68, 0.65, 0.66), ground: new Color3(0.46, 0.41, 0.34), intensity: 0.5 },
      sun: { color: new Color3(1, 0.8, 0.6), intensity: 1.35 },
    },
    tiles: QUARRY_TILES,
    water: {
      body: new Color3(0.08, 0.24, 0.24),
      murkPerTile: 1.4,
      reflectivity: 0.2,
      glint: new Color3(1.5, 1.45, 1.35),
      rippleSlope: 0.25,
      waveHeightTiles: 0.006,
      foam: new Color3(0.78, 0.75, 0.68),
      foamTiles: 0.06,
    },
  },
};

const CAMPFIRE_LIGHT = { heightTiles: 1.2, color: new Color3(1, 0.55, 0.22), intensity: 3, rangeM: 10, flicker: 0.12 };

export const lookAt = (map: WorldMap, x: number, z: number): RegionLook =>
  REGION_LOOKS[regionAt(map, x, z).theme];

export const tileLooksOf = (map: WorldMap): LooksAt => (x, z) => lookAt(map, x + 0.5, z + 0.5).tiles;

export function campfireLights(map: Pick<WorldMap, "campfires">): MapLight[] {
  const { heightTiles, color, intensity, rangeM, flicker } = CAMPFIRE_LIGHT;
  return map.campfires.map((c) => ({ at: { x: c.x, y: heightTiles, z: c.z }, color, intensity, rangeM, flicker }));
}

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
