/** Lights, fog and post-processing: the "look" of the game. */
import {
  Color3, Color4, DefaultRenderingPipeline, DirectionalLight, HemisphericLight, ImageProcessingConfiguration,
  PointLight, Scene, Vector3, type Camera,
} from "@babylonjs/core";

export function setupLook(scene: Scene, camera: Camera): { lantern: PointLight } {
  const bg = new Color3(0.04, 0.05, 0.1);
  scene.clearColor = new Color4(bg.r, bg.g, bg.b, 1);
  scene.ambientColor = new Color3(0.2, 0.2, 0.3);

  // Depth fog sells the "deep tower" feeling and hides streaming floors.
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.035;
  scene.fogColor = bg;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, -0.3), scene);
  hemi.intensity = 0.75;
  hemi.groundColor = new Color3(0.1, 0.08, 0.15);

  const sun = new DirectionalLight("moon", new Vector3(0.4, -1, 0.6), scene);
  sun.intensity = 0.6;
  sun.diffuse = new Color3(0.6, 0.7, 1);

  // Warm light carried by the player (positioned by the camera system).
  const lantern = new PointLight("lantern", Vector3.Zero(), scene);
  lantern.diffuse = new Color3(1, 0.7, 0.4);
  lantern.intensity = 1.1;
  lantern.range = 9;

  const pipeline = new DefaultRenderingPipeline("post", true, scene, [camera]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.85;
  pipeline.bloomWeight = 0.5;
  pipeline.bloomKernel = 64;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.exposure = 1.15;
  pipeline.imageProcessing.contrast = 1.25;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 2.5;
  pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0.05, 0);

  return { lantern };
}
