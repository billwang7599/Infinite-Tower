/** Campfires: drawn for any level theme, from the layout's `campfires`. The flames flicker between two frames. */
import type { TransformNode } from "@babylonjs/core";
import type { LevelLayout } from "@infinite-tower/shared";
import { drawCampfire } from "../../gfx/props.js";
import { spriteMaterial } from "../../gfx/sprites.js";
import { flatSprite } from "../entities/sprite.js";
import { layerY, type FieldView } from "../scene.js";

const FLICKER_SECONDS = 0.14;
const SIZE = 1.8;

export function buildCampfires(view: FieldView, level: LevelLayout, root: TransformNode): void {
  if (level.campfires.length === 0) return;
  const frames = [0, 1].map((f) => spriteMaterial(view.scene, `campfire-${f}`, drawCampfire(f as 0 | 1)));
  const meshes = level.campfires.map((c, i) => {
    const m = flatSprite(view, `campfire-${i}`, SIZE, frames[0]!);
    m.position.set(c.x, layerY(c.z, 0.25), c.z); // under actors standing in front of it, over the ground
    m.parent = root;
    return m;
  });
  let t = 0;
  const flicker = view.scene.onBeforeRenderObservable.add(() => {
    t += view.scene.getEngine().getDeltaTime() / 1000;
    const frame = frames[Math.floor(t / FLICKER_SECONDS) % 2]!;
    for (const m of meshes) m.material = frame;
  });
  // The level's root takes the meshes, materials and textures with it; the observer has to go by hand.
  root.onDisposeObservable.add(() => view.scene.onBeforeRenderObservable.remove(flicker));
}
