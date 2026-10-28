/** The overworld's Babylon scene: top-down 2D with an orthographic camera, every surface a flat textured quad. */
import {
  Camera, Color4, FreeCamera, MeshBuilder, Scene, Vector3, type AbstractEngine, type Mesh, type StandardMaterial,
  type TransformNode,
} from "@babylonjs/core";
import { DEFAULT_LOOK, type LevelLayout } from "@infinite-tower/shared";
import { drawAlert, drawBoar, drawKobold, playerFrames } from "../../gfx/characters.js";
import type { ChibiFacing } from "../../gfx/look/look.js";
import { pixelMaterial, spriteMaterial, type SpriteDraw } from "../../gfx/sprites.js";
import { tuftTexture } from "../../gfx/textures.js";

export interface OverworldView {
  scene: Scene;
  camera: FreeCamera;
  /** null until the server's first `level`. */
  level: LevelLayout | null;
  levelRoot: TransformNode | null;
  materials: {
    /** The player's chibi facing each way (OverworldSprite.facings). */
    player: Record<ChibiFacing, StandardMaterial>;
    boar: StandardMaterial;
    kobold: StandardMaterial;
    alert: StandardMaterial;
    tuft: StandardMaterial;
  };
}

/** Sprites lower on screen draw on top (classic top-down layering): nudge them toward the camera. */
export const layerY = (z: number, base: number) => base - z * 0.002;

/** How high the straight-down camera hangs over the overworld (it only ever moves in x and z). */
export const CAMERA_HEIGHT = 30;

/** A flat quad lying on the overworld, `sizeTiles` across, top of the sprite toward +z (up on screen). */
export function flatSprite(view: OverworldView, name: string, sizeTiles: number, material: StandardMaterial): Mesh {
  const m = MeshBuilder.CreatePlane(name, { size: sizeTiles }, view.scene);
  m.rotation.x = Math.PI / 2;
  m.material = material;
  return m;
}

export function createOverworldScene(engine: AbstractEngine): OverworldView {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.16, 0.3, 0.16, 1);
  scene.skipPointerMovePicking = true;

  // Straight-down orthographic camera: +x right, +z up on screen.
  const camera = new FreeCamera("overworld-camera", new Vector3(0, CAMERA_HEIGHT, 0), scene);
  camera.rotation.set(Math.PI / 2, 0, 0);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 100;
  camera.inputs.clear();

  return {
    scene, camera, level: null, levelRoot: null,
    materials: {
      tuft: pixelMaterial(scene, "overworld-tuft", tuftTexture(scene), { unlit: true }),
      player: chibiMaterials(scene, playerFrames(DEFAULT_LOOK).chibi),
      boar: spriteMaterial(scene, "overworld-boar", drawBoar),
      kobold: spriteMaterial(scene, "overworld-kobold", drawKobold),
      alert: spriteMaterial(scene, "overworld-alert", drawAlert),
    },
  };
}

function chibiMaterials(
  scene: Scene, frames: Record<ChibiFacing, SpriteDraw>,
): Record<ChibiFacing, StandardMaterial> {
  const material = (facing: ChibiFacing) => spriteMaterial(scene, `overworld-player-${facing}`, frames[facing]);
  return { front: material("front"), back: material("back"), side: material("side") };
}
