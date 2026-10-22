/**
 * The overworld scene: a top-down 2D field with its own Babylon scene and an orthographic camera.
 * Everything is a flat, unlit textured quad. Rules live in shared/src/overworld; this folder only draws.
 */
import {
  Camera, Color4, FreeCamera, Material, Scene, StandardMaterial, Vector3, type DynamicTexture, type Engine,
} from "@babylonjs/core";
import { drawAlert, drawBoar, drawPlayerIdle } from "../gfx/characters.js";
import { spriteMaterial, spriteTexture } from "../gfx/sprites.js";
import { buildTerrain } from "./terrain.js";
import { tuftTexture } from "./textures.js";

export interface MapView {
  scene: Scene;
  camera: FreeCamera;
  materials: { player: StandardMaterial; boar: StandardMaterial; alert: StandardMaterial; tuft: StandardMaterial };
}

/** Sprites lower on screen draw on top (classic top-down layering): nudge them toward the camera. */
export const layerY = (z: number, base: number) => base - z * 0.002;

/** A flat material that ignores lighting: the map is pure 2D. `cutout` alpha-tests transparent pixels. */
export function flatMaterial(scene: Scene, name: string, tex: DynamicTexture, cutout = false): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.disableLighting = true;
  if (cutout) {
    m.useAlphaFromDiffuseTexture = true;
    m.transparencyMode = Material.MATERIAL_ALPHATEST;
  }
  return m;
}

export function createMapScene(engine: Engine): MapView {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.16, 0.3, 0.16, 1);
  scene.skipPointerMovePicking = true;

  // Straight-down orthographic camera: +x right, +z up on screen.
  const camera = new FreeCamera("map-camera", new Vector3(0, 30, 0), scene);
  camera.rotation.set(Math.PI / 2, 0, 0);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 100;
  camera.inputs.clear();

  buildTerrain(scene);

  return {
    scene, camera,
    materials: {
      tuft: flatMaterial(scene, "map-tuft", tuftTexture(scene), true),
      player: spriteMaterial(scene, "map-player", spriteTexture(scene, "map-player", drawPlayerIdle)),
      boar: spriteMaterial(scene, "map-boar", spriteTexture(scene, "map-boar", drawBoar)),
      alert: spriteMaterial(scene, "map-alert", spriteTexture(scene, "map-alert", drawAlert)),
    },
  };
}
