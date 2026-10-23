/**
 * The field's Babylon scene: top-down 2D with an orthographic camera, every surface a flat textured quad.
 * The level itself (ground, tall grass, border) is drawn by levels/, picked by the layout's theme.
 */
import { Camera, Color4, FreeCamera, Scene, Vector3, type Engine, type StandardMaterial, type TransformNode } from "@babylonjs/core";
import { DEFAULT_LOOK, type LevelLayout } from "@infinite-tower/shared";
import { drawAlert, drawBoar, playerFrames } from "../gfx/characters.js";
import { pixelMaterial, spriteMaterial } from "../gfx/sprites.js";
import { tuftTexture } from "../gfx/textures.js";

export interface FieldView {
  scene: Scene;
  camera: FreeCamera;
  /** The level you're in (from the server's `level` message); null until the first one arrives. */
  level: LevelLayout | null;
  /** Root of the level's meshes. */
  levelRoot: TransformNode | null;
  materials: { player: StandardMaterial; boar: StandardMaterial; alert: StandardMaterial; tuft: StandardMaterial };
}

/** Sprites lower on screen draw on top (classic top-down layering): nudge them toward the camera. */
export const layerY = (z: number, base: number) => base - z * 0.002;

export function createFieldScene(engine: Engine): FieldView {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.16, 0.3, 0.16, 1);
  scene.skipPointerMovePicking = true;

  // Straight-down orthographic camera: +x right, +z up on screen.
  const camera = new FreeCamera("field-camera", new Vector3(0, 30, 0), scene);
  camera.rotation.set(Math.PI / 2, 0, 0);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 100;
  camera.inputs.clear();

  return {
    scene, camera, level: null, levelRoot: null,
    materials: {
      tuft: pixelMaterial(scene, "field-tuft", tuftTexture(scene), { unlit: true }),
      player: spriteMaterial(scene, "field-player", playerFrames(DEFAULT_LOOK).idle),
      boar: spriteMaterial(scene, "field-boar", drawBoar),
      alert: spriteMaterial(scene, "field-alert", drawAlert),
    },
  };
}
