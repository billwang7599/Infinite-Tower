/** The arena's Babylon scene: the third-person camera, lights, fog, shadows and post-processing. */
import {
  Color3, Color4, DefaultRenderingPipeline, DirectionalLight, HemisphericLight,
  ImageProcessingConfiguration, Scene, ShadowGenerator, UniversalCamera, Vector3,
  type AbstractEngine, type Camera, type TransformNode,
} from "@babylonjs/core";
import type { Entity, Vec3 } from "@infinite-tower/shared";
import type { BattleContext } from "../../modes/battle/context.js";
import type { Impact } from "./impact.js";
import { createMaterials, type Materials } from "./materials.js";
import { createSkillKit, type SkillKit } from "./skills.js";

export interface ArenaScene {
  scene: Scene;
  camera: UniversalCamera;
  /** The sun's shadow maps (casters are added to it); not the blob shadows under the sprites. */
  sunShadows: ShadowGenerator;
  materials: Materials;
  skills: SkillKit;
  nodes: Map<Entity, TransformNode>;
  /** Camera shake amplitude, decaying. Hard hits add to it. */
  shake: number;
  impacts: Map<Entity, Impact>;
  battle: BattleContext;
}

const FLOOR_REACH_M = 30;

export function createBattleScene(engine: AbstractEngine, battle: BattleContext): ArenaScene {
  const scene = new Scene(engine);

  const camera = new UniversalCamera("camera", new Vector3(0, 4, -16), scene);
  camera.fov = 0.9;
  camera.minZ = 0.1;
  camera.inputs.clear(); // it follows the battle mode's view

  const sunShadows = setupLook(scene, camera);
  const materials = createMaterials(scene);
  const floorY = (at: Vec3) =>
    at.y - (battle.fight?.physics.floorBelow(at.x, at.y, at.z, FLOOR_REACH_M) ?? 0);
  return {
    scene, camera, sunShadows, materials, skills: createSkillKit(scene, floorY, materials.slashFx),
    nodes: new Map(), shake: 0, impacts: new Map(), battle,
  };
}

/** Returns the sun's shadow generator. */
function setupLook(scene: Scene, camera: Camera): ShadowGenerator {
  const sky = new Color3(0.42, 0.5, 0.62);
  scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
  scene.ambientColor = new Color3(0.25, 0.25, 0.3);

  // Fog hides the edge of the world past the trees.
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.022;
  scene.fogColor = sky;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;
  hemi.diffuse = new Color3(0.8, 0.85, 1);
  hemi.groundColor = new Color3(0.25, 0.22, 0.18);

  // Low warm sun: long shadows show the boar's 3D shape and where it is.
  const sunDir = new Vector3(-0.5, -0.8, 0.45).normalize();
  const sun = new DirectionalLight("sun", sunDir, scene);
  sun.position = sunDir.scale(-40);
  sun.intensity = 1.6;
  sun.diffuse = new Color3(1, 0.86, 0.68);
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 90;

  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.002;
  shadows.normalBias = 0.02;
  shadows.darkness = 0.35;

  const pipeline = new DefaultRenderingPipeline("post", true, scene, [camera]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.9;
  pipeline.bloomWeight = 0.45;
  pipeline.bloomKernel = 48;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.exposure = 1.1;
  pipeline.imageProcessing.contrast = 1.2;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 2;
  pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0.05, 0);

  return shadows;
}
