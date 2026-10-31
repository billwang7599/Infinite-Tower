import {
  Color3, Color4, ColorCurves, Constants, DefaultRenderingPipeline, Effect, ImageProcessingConfiguration, Material,
  MeshBuilder, Matrix, PostProcess, Scene, StandardMaterial, UniversalCamera, Vector3, type AbstractEngine, type Camera,
  type DynamicTexture, type Mesh,
} from "@babylonjs/core";
import type { EnemyId } from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import type { OverworldState } from "../../modes/overworld/components.js";
import { drawAlert, drawCrossedSwords } from "../characters.js";
import { byEnemy } from "../enemies/index.js";
import { createSky, type Sky } from "../sky/sky.js";
import { spriteMaterial, type SpriteDraw } from "../sprites.js";
import { blobTexture } from "../textures.js";

export interface OverworldScene {
  scene: Scene;
  camera: UniversalCamera;
  sky: Sky;
  materials: {
    player: Record<ChibiFacing, StandardMaterial>;
    enemies: Record<EnemyId, StandardMaterial>;
    alert: StandardMaterial;
    fighting: StandardMaterial;
    pile: StandardMaterial;
    bedroll: StandardMaterial;
    blob: StandardMaterial;
  };
  state: OverworldState;
  /** The camera's yaw as drawn, easing between its quarter turns: 0 looks north, π/2 east. */
  yawRad: number;
}

/** Radians every upright picture leans back from vertical, toward facing the camera. */
export const SPRITE_TILT_RAD = 0.3;

export function createOverworldScene(engine: AbstractEngine, state: OverworldState): OverworldScene {
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  const camera = new UniversalCamera("overworld-camera", new Vector3(0, 15, -13), scene);
  camera.fov = 0.55;
  camera.minZ = 0.5;
  camera.maxZ = 120;
  camera.inputs.clear();
  const sky = createSky(scene);
  postProcess(camera);
  const sprite = (name: string, draw: SpriteDraw) => spriteMaterial(scene, name, draw);
  return {
    scene, camera, sky, state, yawRad: 0,
    materials: {
      player: {
        front: sprite("overworld-player-front", () => {}),
        back: sprite("overworld-player-back", () => {}),
        side: sprite("overworld-player-side", () => {}),
      },
      enemies: byEnemy(({ sprite: s }, id) => sprite(`overworld-${id}`, s.draw)),
      alert: sprite("overworld-alert", drawAlert),
      fighting: sprite("overworld-fighting", drawCrossedSwords),
      pile: sprite("overworld-pile", drawPile),
      bedroll: sprite("overworld-bedroll", drawBedroll),
      blob: blobMaterial(scene),
    },
  };
}

export function cutoutMaterial(scene: Scene, name: string, tex: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.useAlphaFromDiffuseTexture = true;
  m.transparencyMode = Material.MATERIAL_ALPHATEST;
  m.backFaceCulling = false;
  m.specularColor = Color3.Black();
  m.disableLighting = true;
  m.emissiveColor = Color3.White();
  return m;
}

export function standingQuad(scene: Scene, name: string, width: number, height: number, footShare = 0): Mesh {
  const m = MeshBuilder.CreatePlane(name, { width, height }, scene);
  m.bakeTransformIntoVertices(Matrix.Translation(0, height * (0.5 - footShare), 0));
  m.rotation.x = SPRITE_TILT_RAD;
  return m;
}

export const drawPile: SpriteDraw = (px) => {
  const outline = "#1b1b2a", sack = "#a07f4f", light = "#c29c62", shade = "#6e5434", cord = "#4a2f1c";
  const bone = "#efe6cf", glint = "#ffe9a0";
  px(5, 13, 14, 8, outline);
  px(6, 11, 12, 11, outline);
  px(9, 8, 6, 4, outline);
  px(14, 4, 3, 7, outline);
  px(15, 5, 1, 6, bone);
  px(14, 5, 1, 1, bone);
  px(7, 12, 10, 9, sack);
  px(6, 14, 12, 6, sack);
  px(8, 13, 3, 5, light);
  px(14, 15, 3, 5, shade);
  px(7, 20, 10, 1, shade);
  px(10, 9, 4, 3, sack);
  px(9, 11, 6, 1, cord);
  px(6, 3, 1, 3, glint);
  px(5, 4, 3, 1, glint);
  px(19, 8, 1, 1, glint);
};

const drawBedroll: SpriteDraw = (px) => {
  const outline = "#1b1b2a", wool = "#5f6b3a", light = "#7a8750", shade = "#434c28", end = "#8a9660";
  const stripe = "#c8642a", cord = "#4a2f1c", paper = "#efe6cf", ink = "#6b6258";
  px(4, 13, 15, 10, outline);
  px(3, 14, 17, 8, outline);
  px(18, 14, 4, 8, outline);
  px(19, 13, 2, 10, outline);
  px(4, 14, 15, 8, wool);
  px(4, 14, 15, 2, light);
  px(4, 20, 15, 2, shade);
  px(9, 14, 2, 8, stripe);
  px(19, 14, 2, 8, end);
  px(18, 15, 4, 6, end);
  px(19, 16, 2, 4, shade);
  px(20, 17, 1, 2, end);
  px(6, 13, 1, 10, cord);
  px(15, 13, 1, 10, cord);
  px(12, 8, 5, 7, outline);
  px(13, 9, 3, 5, paper);
  px(13, 10, 3, 1, ink);
  px(13, 12, 2, 1, ink);
};

function blobMaterial(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("overworld-blob", scene);
  m.diffuseTexture = blobTexture(scene);
  m.useAlphaFromDiffuseTexture = true;
  m.diffuseColor = Color3.Black();
  m.disableLighting = true;
  m.zOffset = -2;
  return m;
}

function postProcess(camera: Camera): void {
  const scene = camera.getScene();
  const post = new DefaultRenderingPipeline("overworld-post", true, scene, [camera]);
  post.fxaaEnabled = false;
  post.bloomEnabled = true;
  post.bloomThreshold = 0.75;
  post.bloomWeight = 0.5;
  post.bloomKernel = 64;
  post.bloomScale = 0.5;
  post.imageProcessingEnabled = true;
  post.imageProcessing.toneMappingEnabled = true;
  post.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  post.imageProcessing.exposure = 1.2;
  post.imageProcessing.contrast = 1.2;
  post.imageProcessing.colorCurvesEnabled = true;
  const grade = new ColorCurves();
  grade.globalHue = 35;
  grade.globalDensity = 18;
  grade.globalSaturation = -12;
  grade.shadowsHue = 230;
  grade.shadowsDensity = 35;
  grade.highlightsHue = 40;
  grade.highlightsDensity = 25;
  post.imageProcessing.colorCurves = grade;
  post.imageProcessing.vignetteEnabled = true;
  post.imageProcessing.vignetteWeight = 1.8;
  post.imageProcessing.vignetteColor = new Color4(0.05, 0.02, 0, 0);
  tiltShift(camera);
}

Effect.ShadersStore["tiltShiftFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 texelSize;
uniform float maxRadiusPx;
void main(void) {
  float d = clamp((abs(vUV.y - 0.5) - 0.17) / 0.33, 0.0, 1.0);
  float r = d * d * maxRadiusPx;
  vec4 sum = texture2D(textureSampler, vUV);
  if (r < 0.5) { gl_FragColor = sum; return; }
  for (int i = 0; i < 16; i++) {
    float f = float(i), a = f * 2.39996;
    sum += texture2D(textureSampler, vUV + vec2(cos(a), sin(a)) * r * sqrt((f + 0.5) / 16.0) * texelSize);
  }
  gl_FragColor = sum / 17.0;
}`;

function tiltShift(camera: Camera): void {
  const pass = new PostProcess(
    "overworld-tilt-shift", "tiltShift", ["texelSize", "maxRadiusPx"], null, 1, camera,
    Constants.TEXTURE_BILINEAR_SAMPLINGMODE, undefined, false, null, Constants.TEXTURETYPE_HALF_FLOAT,
  );
  pass.onApply = (effect) => {
    effect.setFloat2("texelSize", 1 / pass.width, 1 / pass.height);
    effect.setFloat("maxRadiusPx", 5 * (pass.height / 720));
  };
}
