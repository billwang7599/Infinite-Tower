import type { Scene, TransformNode } from "@babylonjs/core";
import type { LevelLayout } from "@infinite-tower/shared";
import { flatSprite, layerY } from "../overworld/scene.js";
import type { Scenery } from "../overworld3d/scenery.js";
import { spriteMaterial, type SpriteDraw } from "../sprites.js";
import { buildGrassField } from "./grass-field/grass-field.js";
import { grassFieldScenery } from "./grass-field/scenery.js";

interface LevelLook {
  /** Everything it makes hangs off the returned root, so leaving the level is one dispose. */
  build(scene: Scene, level: LevelLayout): TransformNode;
  scenery(level: LevelLayout): Scenery;
}

export const LEVEL_LOOKS: Record<LevelLayout["theme"], LevelLook> = {
  "grass-field": { build: buildGrassField, scenery: grassFieldScenery },
};

export interface LevelDrawing {
  root: TransformNode;
  flicker(dt: number): void;
}

export function buildLevel(scene: Scene, level: LevelLayout): LevelDrawing {
  const root = LEVEL_LOOKS[level.theme].build(scene, level);
  return { root, flicker: buildCampfires(scene, level, root) };
}

export const FLICKER_TIME = 0.14;
const CAMPFIRE_TILES = 1.8;

/** Any theme's campfires, the flames flickering between two frames. */
function buildCampfires(scene: Scene, level: LevelLayout, root: TransformNode): (dt: number) => void {
  if (level.campfires.length === 0) return () => {};
  const frames = ([0, 1] as const).map((f) => spriteMaterial(scene, `campfire-${f}`, drawCampfire(f)));
  const meshes = level.campfires.map((c, i) => {
    const m = flatSprite(scene, `campfire-${i}`, CAMPFIRE_TILES, frames[0]!);
    m.position.set(c.x, layerY(c.z, 0.25), c.z); // under actors standing in front of it, over the ground
    m.parent = root;
    return m;
  });
  let time = 0;
  return (dt) => {
    time += dt;
    const frame = frames[Math.floor(time / FLICKER_TIME) % 2]!;
    for (const m of meshes) m.material = frame;
  };
}

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
