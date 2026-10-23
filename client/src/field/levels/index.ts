/**
 * Level renderers by theme. The server sends a level's layout (shared LevelLayout); its `theme`
 * picks the function that draws it. Everything a renderer makes hangs off the returned root node,
 * so leaving the level is one dispose. New look: add a folder next to grass-field/ and list it here.
 */
import type { Scene, TransformNode } from "@babylonjs/core";
import type { LevelLayout } from "@infinite-tower/shared";
import type { FieldView } from "../scene.js";
import { buildGrassField } from "./grass-field/terrain.js";

export type LevelRenderer = (scene: Scene, level: LevelLayout) => TransformNode;

export const LEVEL_RENDERERS: Record<LevelLayout["theme"], LevelRenderer> = {
  "grass-field": buildGrassField,
};

/** Swap in a new level's drawing (meshes, materials and textures of the old one are disposed). */
export function loadLevel(view: FieldView, level: LevelLayout): void {
  unloadLevel(view);
  view.level = level;
  view.levelRoot = LEVEL_RENDERERS[level.theme](view.scene, level);
}

export function unloadLevel(view: FieldView): void {
  view.levelRoot?.dispose(false, true);
  view.levelRoot = null;
  view.level = null;
}
