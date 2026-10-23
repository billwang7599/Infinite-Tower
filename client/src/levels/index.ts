/**
 * Level renderers by theme. The server sends a level's layout (shared LevelLayout); its `theme`
 * picks the function that draws it. Everything a renderer makes hangs off the returned root node,
 * so leaving the level is one dispose. New look: add a folder next to grass-field/ and list it here.
 */
import type { Scene, TransformNode } from "@babylonjs/core";
import type { LevelLayout } from "@infinite-tower/shared";
import { buildGrassField } from "./grass-field/terrain.js";

export type LevelRenderer = (scene: Scene, level: LevelLayout) => TransformNode;

export const LEVEL_RENDERERS: Record<LevelLayout["theme"], LevelRenderer> = {
  "grass-field": buildGrassField,
};
