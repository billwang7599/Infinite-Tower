import {
  Color4, DefaultRenderingPipeline, ImageProcessingConfiguration, Scene, UniversalCamera, Vector3,
  type AbstractEngine, type Camera, type StandardMaterial, type TransformNode,
} from "@babylonjs/core";
import type { Entity, Vec3 } from "@infinite-tower/shared";
import type { BattleContext } from "../../modes/battle/context.js";
import type { PlayerLook } from "../characters.js";
import { createSky, type Sky } from "../sky/sky.js";
import type { Impact } from "./impact.js";
import { createMaterials, type Materials } from "./materials.js";
import { pixelFlags, pixelPost, type PixelFlags } from "./pixel.js";
import { createSkillKit, type SkillKit } from "./skills.js";

export interface ArenaScene {
  scene: Scene;
  camera: UniversalCamera;
  sky: Sky;
  materials: Materials;
  skills: SkillKit;
  nodes: Map<Entity, TransformNode>;
  looks: Map<Entity, PlayerLook<StandardMaterial>>;
  /** Camera shake amplitude, decaying. Hard hits add to it. */
  shake: number;
  impacts: Map<Entity, Impact>;
  battle: BattleContext;
  pixel: PixelFlags;
}

const FLOOR_REACH_M = 30;

export function createBattleScene(engine: AbstractEngine, battle: BattleContext): ArenaScene {
  const scene = new Scene(engine);

  const camera = new UniversalCamera("camera", new Vector3(0, 4, -16), scene);
  camera.fov = 0.9;
  camera.minZ = 0.1;
  camera.inputs.clear(); // it follows the battle mode's view

  const sky = createSky(scene);
  const pixel = pixelFlags(import.meta.env.DEV ? location.search : "");
  postProcess(scene, camera, pixel);
  const materials = createMaterials(scene);
  const floorY = (at: Vec3) =>
    at.y - (battle.fight?.physics.floorBelow(at.x, at.y, at.z, FLOOR_REACH_M) ?? 0);
  return {
    scene, camera, sky, materials, skills: createSkillKit(scene, floorY, materials.slashFx),
    nodes: new Map(), looks: new Map(), shake: 0, impacts: new Map(), battle, pixel,
  };
}

function postProcess(scene: Scene, camera: Camera, pixel: PixelFlags): void {
  const pipeline = new DefaultRenderingPipeline("post", true, scene, [camera]);
  pipeline.fxaaEnabled = pixel.scale === null;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.9;
  pipeline.bloomWeight = 0.45;
  pipeline.bloomKernel = pixel.scale === null ? 48 : 16;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.exposure = 1.1;
  pipeline.imageProcessing.contrast = 1.2;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 2;
  pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0.05, 0);
  pixelPost(scene, camera, pixel);
}
