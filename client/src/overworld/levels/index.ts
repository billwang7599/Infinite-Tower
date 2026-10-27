/**
 * Level renderers by theme: the layout's `theme` picks the function that draws it. Everything a renderer makes hangs
 * off the returned root node, so leaving the level is one dispose.
 */
import type { Scene, TransformNode } from "@babylonjs/core";
import type { LevelLayout } from "@infinite-tower/shared";
import { frameSeconds } from "../../core/time.js";
import { spriteMaterial, type SpriteDraw } from "../../gfx/sprites.js";
import { flatSprite, layerY, type OverworldView } from "../scene.js";
import { buildGrassField } from "./grass-field.js";

type LevelRenderer = (scene: Scene, level: LevelLayout) => TransformNode;

const LEVEL_RENDERERS: Record<LevelLayout["theme"], LevelRenderer> = {
  "grass-field": buildGrassField,
};

/** Swap in a new level's drawing (meshes, materials and textures of the old one are disposed). */
export function loadLevel(view: OverworldView, level: LevelLayout): void {
  unloadLevel(view);
  view.level = level;
  view.levelRoot = LEVEL_RENDERERS[level.theme](view.scene, level);
  buildCampfires(view, level, view.levelRoot);
}

export function unloadLevel(view: OverworldView): void {
  view.levelRoot?.dispose(false, true);
  view.levelRoot = null;
  view.level = null;
}

const FLICKER_TIME = 0.14;
const CAMPFIRE_TILES = 1.8;

/** Any theme's campfires, the flames flickering between two frames. */
function buildCampfires(view: OverworldView, level: LevelLayout, root: TransformNode): void {
  if (level.campfires.length === 0) return;
  const frames = ([0, 1] as const).map((f) => spriteMaterial(view.scene, `campfire-${f}`, drawCampfire(f)));
  const meshes = level.campfires.map((c, i) => {
    const m = flatSprite(view, `campfire-${i}`, CAMPFIRE_TILES, frames[0]!);
    m.position.set(c.x, layerY(c.z, 0.25), c.z); // under actors standing in front of it, over the ground
    m.parent = root;
    return m;
  });
  let time = 0;
  const flicker = view.scene.onBeforeRenderObservable.add(() => {
    time += frameSeconds(view.scene.getEngine());
    const frame = frames[Math.floor(time / FLICKER_TIME) % 2]!;
    for (const m of meshes) m.material = frame;
  });
  // The level's root takes the meshes, materials and textures with it; the observer has to go by hand.
  root.onDisposeObservable.add(() => view.scene.onBeforeRenderObservable.remove(flicker));
}

const LOG = "#5a3a1e", LOG_HI = "#7a5230", STONE = "#7c7f86", STONE_DARK = "#5d6067";

/** A ring of stones, two crossed logs and a fire (24x24 pixels, sprites.ts). */
function drawCampfire(frame: 0 | 1): SpriteDraw {
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
