import {
  Color4, DefaultRenderingPipeline, ImageProcessingConfiguration, Scene, UniversalCamera, Vector3,
  type AbstractEngine, type Camera, type TransformNode,
} from "@babylonjs/core";
import type { Entity, Vec3 } from "@infinite-tower/shared";
import type { BattleContext } from "../../modes/battle/context.js";
import { createSky, type Sky } from "../sky/sky.js";
import type { Impact } from "./impact.js";
import { createMaterials, type Materials, type PlayerFrames } from "./materials.js";
import { createSkillKit, type SkillKit } from "./skills.js";

export interface ArenaScene {
  scene: Scene;
  camera: UniversalCamera;
  sky: Sky;
  materials: Materials;
  skills: SkillKit;
  nodes: Map<Entity, TransformNode>;
  /** Every other player's; you're drawn in `materials.player`. */
  peerFrames: Map<Entity, PlayerFrames>;
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

  const sky = createSky(scene);
  postProcess(scene, camera);
  const materials = createMaterials(scene);
  const floorY = (at: Vec3) =>
    at.y - (battle.fight?.physics.floorBelow(at.x, at.y, at.z, FLOOR_REACH_M) ?? 0);
  return {
    scene, camera, sky, materials, skills: createSkillKit(scene, floorY, materials.slashFx),
    nodes: new Map(), peerFrames: new Map(), shake: 0, impacts: new Map(), battle,
  };
}

function postProcess(scene: Scene, camera: Camera): void {
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
}
