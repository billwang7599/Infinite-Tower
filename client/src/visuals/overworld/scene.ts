/** The overworld's Babylon scene: top-down 2D with an orthographic camera, every surface a flat textured quad. */
import {
  Camera, Color4, FreeCamera, MeshBuilder, Scene, Vector3, type AbstractEngine, type Mesh, type StandardMaterial,
} from "@babylonjs/core";
import type { ChibiFacing } from "../../gfx/look/look.js";
import type { OverworldState } from "../../modes/overworld/components.js";
import { drawAlert, drawBoar, drawGoblin, drawKobold } from "../characters.js";
import { pixelMaterial, spriteMaterial } from "../sprites.js";
import { tuftTexture } from "../textures.js";

export interface OverworldScene {
  scene: Scene;
  camera: FreeCamera;
  materials: {
    player: Record<ChibiFacing, StandardMaterial>;
    boar: StandardMaterial;
    kobold: StandardMaterial;
    goblin: StandardMaterial;
    alert: StandardMaterial;
    tuft: StandardMaterial;
  };
  state: OverworldState;
}

/** Sprites lower on screen draw on top (classic top-down layering): nudge them toward the camera. */
export const layerY = (z: number, base: number) => base - z * 0.002;

/** How high the straight-down camera hangs over the overworld (it only ever moves in x and z). */
export const CAMERA_HEIGHT = 30;

/** A flat quad lying on the overworld, `sizeTiles` across, top of the sprite toward +z (up on screen). */
export function flatSprite(scene: Scene, name: string, sizeTiles: number, material: StandardMaterial): Mesh {
  const m = MeshBuilder.CreatePlane(name, { size: sizeTiles }, scene);
  m.rotation.x = Math.PI / 2;
  m.material = material;
  return m;
}

export function createOverworldScene(engine: AbstractEngine, state: OverworldState): OverworldScene {
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
    scene, camera, state,
    materials: {
      tuft: pixelMaterial(scene, "overworld-tuft", tuftTexture(scene), { unlit: true }),
      player: chibiMaterials(scene),
      boar: spriteMaterial(scene, "overworld-boar", drawBoar),
      kobold: spriteMaterial(scene, "overworld-kobold", drawKobold),
      goblin: spriteMaterial(scene, "overworld-goblin", drawGoblin),
      alert: spriteMaterial(scene, "overworld-alert", drawAlert),
    },
  };
}

function chibiMaterials(scene: Scene): Record<ChibiFacing, StandardMaterial> {
  const material = (facing: ChibiFacing) => spriteMaterial(scene, `overworld-player-${facing}`, () => {});
  return { front: material("front"), back: material("back"), side: material("side") };
}
