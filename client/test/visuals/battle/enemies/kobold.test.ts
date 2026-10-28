import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { koboldPose } from "../../../../src/visuals/battle/enemies/kobold/pose.js";

const ACTIVE = 0.12;

describe("the kobold's pose", () => {
  test("a swing's wind-up turns the blade to where the swing starts, and its arrow shows the way", () => {
    const start = koboldPose("swordWindup", 0, 0, "lr", ACTIVE), wound = koboldPose("swordWindup", 1, 1, "lr", ACTIVE);
    assert.ok(wound.tell > start.tell && start.tell > 0);
    assert.ok(wound.blade.x > 0.5);
    assert.ok(wound.arrowRad !== null && Math.abs(wound.arrowRad - Math.PI / 2) < 1e-9);
  });

  test("a stab's wind-up draws the hand back and shows a ring, not an arrow", () => {
    const pose = koboldPose("swordWindup", 1, 1, "stab", ACTIVE);
    assert.equal(pose.arrowRad, null);
    assert.ok(pose.tell > 0 && pose.handZ < koboldPose("approach", 0, 0, "stab", ACTIVE).handZ);
  });

  test("mid-swing the blade sweeps exactly through straight ahead; guard and recovery are eased into", () => {
    const mid = koboldPose("sword", ACTIVE / 2, 0, "lr", ACTIVE);
    assert.equal(mid.bladeExact, true);
    assert.ok(mid.blade.z > 0.9);
    assert.equal(koboldPose("swordRecover", 0, 0, "lr", ACTIVE).bladeExact, false);
  });

  test("dead it falls over; parried it sees stars", () => {
    assert.equal(koboldPose("dead", 0, 0, "lr", ACTIVE).roll, Math.PI / 2);
    assert.equal(koboldPose("parried", 0.1, 0, "lr", ACTIVE).stars, true);
  });
});
