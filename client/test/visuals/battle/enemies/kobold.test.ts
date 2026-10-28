import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AttackKind, EnemyState } from "@infinite-tower/shared";
import { koboldPose } from "../../../../src/visuals/battle/enemies/kobold/pose.js";
import { MOTIONS } from "../../../../src/visuals/battle/weapons.js";

const ACTIVE = 0.12;
const poseOf = (state: EnemyState, t: number, k: number, attack: AttackKind) =>
  koboldPose(state, t, k, attack, ACTIVE, MOTIONS.sword);

describe("the kobold's pose", () => {
  test("a swing's wind-up turns the blade to where the swing starts, and its arrow shows the way", () => {
    const start = poseOf("weaponWindup", 0, 0, "lr"), wound = poseOf("weaponWindup", 1, 1, "lr");
    assert.ok(wound.tell > start.tell && start.tell > 0);
    assert.ok(wound.blade.x > 0.5);
    assert.ok(wound.arrowRad !== null && Math.abs(wound.arrowRad - Math.PI / 2) < 1e-9);
  });

  test("a stab's wind-up draws the hand back and shows a ring, not an arrow", () => {
    const pose = poseOf("weaponWindup", 1, 1, "stab");
    assert.equal(pose.arrowRad, null);
    assert.ok(pose.tell > 0 && pose.handZ < poseOf("approach", 0, 0, "stab").handZ);
  });

  test("mid-swing the blade sweeps exactly through straight ahead; guard and recovery are eased into", () => {
    const mid = poseOf("weapon", ACTIVE / 2, 0, "lr");
    assert.equal(mid.bladeExact, true);
    assert.ok(mid.blade.z > 0.9);
    assert.equal(poseOf("weaponRecover", 0, 0, "lr").bladeExact, false);
  });

  test("dead it falls over; parried it sees stars", () => {
    assert.equal(poseOf("dead", 0, 0, "lr").roll, Math.PI / 2);
    assert.equal(poseOf("parried", 0.1, 0, "lr").stars, true);
  });
});
