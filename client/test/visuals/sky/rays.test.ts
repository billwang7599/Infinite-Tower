import assert from "node:assert/strict";
import { test } from "node:test";
import { NullEngine, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import { sunOnScreen } from "../../../src/visuals/sky/rays.js";

test("the sun's place on screen: the middle straight ahead, up and right as it is, nowhere behind", () => {
  const scene = new Scene(new NullEngine());
  const camera = new UniversalCamera("camera", new Vector3(3, 2, 1), scene);
  camera.setTarget(new Vector3(3, 2, 11));
  const viewProjection = camera.getViewMatrix().multiply(camera.getProjectionMatrix());
  const ahead = sunOnScreen({ x: 0, y: 0, z: 1 }, viewProjection)!;
  assert.ok(Math.abs(ahead.u - 0.5) < 1e-6 && Math.abs(ahead.v - 0.5) < 1e-6);
  const upRight = sunOnScreen({ x: 0.1, y: 0.1, z: 1 }, viewProjection)!;
  assert.ok(upRight.u > 0.5 && upRight.v > 0.5);
  assert.equal(sunOnScreen({ x: 0, y: 0.2, z: -1 }, viewProjection), null);
  scene.dispose();
});
