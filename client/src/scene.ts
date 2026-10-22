/** Lights, fog, shadows and post-processing: the "look" of the game. */
import {
  Color3, Color4, DefaultRenderingPipeline, DirectionalLight, HemisphericLight, ImageProcessingConfiguration,
  Scene, ShadowGenerator, Vector3, type Camera,
} from "@babylonjs/core";

export function setupLook(scene: Scene, camera: Camera): { shadows: ShadowGenerator } {
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

  return { shadows };
}
