import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Effect } from "@babylonjs/core";
import "../../../src/visuals/overworld/scene.js";
import "../../../src/visuals/sky/dome.js";

describe("the overworld's sun haze", () => {
  test("is drawn on the sky, so walls near the camera never take its tint", () => {
    assert.doesNotMatch(Effect.ShadersStore.tiltShiftFragmentShader!, /toSun|haze/);
    assert.match(Effect.ShadersStore.skyDomeFragmentShader!, /haze/);
  });
});
