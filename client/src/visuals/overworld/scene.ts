import {
  Color3, Color4, ColorCurves, Constants, DefaultRenderingPipeline, DirectionalLight, Effect, HemisphericLight,
  ImageProcessingConfiguration, Material, MeshBuilder, Matrix, PostProcess, Scene, ShadowGenerator, StandardMaterial,
  UniversalCamera, Vector3, type AbstractEngine, type Camera, type DynamicTexture, type Mesh,
} from "@babylonjs/core";
import type { EnemyId } from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import type { OverworldState } from "../../modes/overworld/components.js";
import { drawAlert } from "../characters.js";
import { byEnemy } from "../enemies/index.js";
import { spriteMaterial, type SpriteDraw } from "../sprites.js";
import { blobTexture } from "../textures.js";

export interface OverworldScene {
  scene: Scene;
  camera: UniversalCamera;
  sunShadows: ShadowGenerator;
  materials: {
    player: Record<ChibiFacing, StandardMaterial>;
    enemies: Record<EnemyId, StandardMaterial>;
    alert: StandardMaterial;
    blob: StandardMaterial;
  };
  state: OverworldState;
}

/** Radians every upright picture leans back from vertical, toward facing the camera. */
export const SPRITE_TILT_RAD = 0.3;
/** Sprites aren't lit by the sun (unlit, a StandardMaterial shows texture × emissive); this warms them. */
const SPRITE_TINT = new Color3(0.9, 0.82, 0.78);

export function createOverworldScene(engine: AbstractEngine, state: OverworldState): OverworldScene {
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  const camera = new UniversalCamera("overworld-camera", new Vector3(0, 15, -13), scene);
  camera.fov = 0.55;
  camera.minZ = 0.5;
  camera.maxZ = 120;
  camera.inputs.clear();
  const sunShadows = setupLook(scene, camera);
  const sprite = (name: string, draw: SpriteDraw) => spriteLook(spriteMaterial(scene, name, draw));
  return {
    scene, camera, sunShadows, state,
    materials: {
      player: {
        front: sprite("overworld-player-front", () => {}),
        back: sprite("overworld-player-back", () => {}),
        side: sprite("overworld-player-side", () => {}),
      },
      enemies: byEnemy(({ sprite: s }, id) => sprite(`overworld-${id}`, s.draw)),
      alert: sprite("overworld-alert", drawAlert),
      blob: blobMaterial(scene),
    },
  };
}

export function spriteLook(m: StandardMaterial): StandardMaterial {
  m.emissiveTexture = null;
  m.disableLighting = true;
  m.emissiveColor = SPRITE_TINT;
  return m;
}

export function cutoutMaterial(scene: Scene, name: string, tex: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.useAlphaFromDiffuseTexture = true;
  m.transparencyMode = Material.MATERIAL_ALPHATEST;
  m.backFaceCulling = false;
  m.specularColor = Color3.Black();
  return spriteLook(m);
}

export function standingQuad(scene: Scene, name: string, width: number, height: number, footShare = 0): Mesh {
  const m = MeshBuilder.CreatePlane(name, { width, height }, scene);
  m.bakeTransformIntoVertices(Matrix.Translation(0, height * (0.5 - footShare), 0));
  m.rotation.x = SPRITE_TILT_RAD;
  return m;
}

function blobMaterial(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("overworld-blob", scene);
  m.diffuseTexture = blobTexture(scene);
  m.useAlphaFromDiffuseTexture = true;
  m.diffuseColor = Color3.Black();
  m.disableLighting = true;
  m.zOffset = -2;
  return m;
}

function setupLook(scene: Scene, camera: Camera): ShadowGenerator {
  const haze = new Color3(0.27, 0.25, 0.29);
  scene.clearColor = new Color4(haze.r, haze.g, haze.b, 1);
  scene.ambientColor = new Color3(0.26, 0.24, 0.3);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 26;
  scene.fogEnd = 60;
  scene.fogColor = haze;

  const sky = new HemisphericLight("overworld-sky", new Vector3(0, 1, 0), scene);
  sky.intensity = 0.5;
  sky.diffuse = new Color3(0.55, 0.58, 0.82);
  sky.groundColor = new Color3(0.32, 0.26, 0.22);

  // Low from the south-east, so the cliff faces toward the camera are lit and shadows fall up and left.
  const sunDir = new Vector3(-0.55, -0.7, 0.45).normalize();
  const sun = new DirectionalLight("overworld-sun", sunDir, scene);
  sun.position = sunDir.scale(-50);
  sun.intensity = 1.5;
  sun.diffuse = new Color3(1, 0.68, 0.46);
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.004;
  shadows.darkness = 0.4;

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
  return shadows;
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
