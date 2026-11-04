import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import { onScreen, ringLights, wedgeOf } from "../../../src/visuals/battle/overlay.js";
import { swingAt, waySwingAt } from "../../fixtures/swings.js";

describe("your own aim ring", () => {
  test("lights the wedge on the side the aimed swing comes from", () => {
    assert.equal(wedgeOf("rl"), 0);
    assert.equal(wedgeOf("trbl"), 1);
    assert.equal(wedgeOf("tb"), 2);
    assert.equal(wedgeOf("tlbr"), 3);
    assert.equal(wedgeOf("lr"), 4);
    assert.equal(wedgeOf("bltr"), 5);
    assert.equal(wedgeOf("brtl"), 7);
  });

  test("shows the aim with no swing going, not only on attack", () => {
    assert.deepEqual(ringLights("lr", null), { lit: 4, stab: false });
  });

  test("a stab shows the centre mark only while it winds up", () => {
    const { liveAt } = swingAt("light", "stab", 0);
    assert.equal(ringLights("tb", waySwingAt("stab", 0)).stab, true);
    assert.equal(ringLights("tb", waySwingAt("stab", liveAt)).stab, false);
    assert.equal(ringLights("tb", waySwingAt("lr", 0)).stab, false);
  });
});

describe("where the overlay puts a point in the world", () => {
  // The engine renders small (the pixel art); the overlay is full size, the same shape.
  const engine = new NullEngine({
    renderWidth: 640, renderHeight: 360, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1,
  });
  const camera = new UniversalCamera("camera", new Vector3(0, 0, -10), new Scene(engine));
  camera.setTarget(Vector3.Zero());
  camera.fov = 0.8;
  const pxPerMAt10M = 1080 / 2 / Math.tan(camera.fov / 2) / 10;
  // Babylon's matrices are 32-bit floats.
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;

  test("what the camera looks at is the overlay's centre, scaled to the overlay's size", () => {
    const at = onScreen({ x: 0, y: 0, z: 0 }, camera, 1920, 1080)!;
    assert.ok(near(at.x, 960) && near(at.y, 540), `${at.x}, ${at.y}`);
    assert.ok(near(at.pxPerM, pxPerMAt10M), String(at.pxPerM));
  });

  test("right and up in the view are right and up on screen, a metre across the scale's pixels", () => {
    const at = onScreen({ x: 1, y: 1, z: 0 }, camera, 1920, 1080)!;
    assert.ok(near(at.x, 960 + pxPerMAt10M), String(at.x));
    assert.ok(near(at.y, 540 - pxPerMAt10M), String(at.y));
  });

  test("farther away is smaller", () => {
    assert.ok(near(onScreen({ x: 0, y: 0, z: 10 }, camera, 1920, 1080)!.pxPerM, pxPerMAt10M / 2));
  });

  test("behind the camera, or nearer than it draws, isn't on screen", () => {
    assert.equal(onScreen({ x: 0, y: 0, z: -12 }, camera, 1920, 1080), null);
    assert.equal(onScreen({ x: 0, y: 0, z: -10 + camera.minZ / 2 }, camera, 1920, 1080), null);
  });
});
