import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AttackKind, EnemyState } from "@infinite-tower/shared";
import { koboldPose } from "../../../../src/visuals/enemies/kobold-swordsman/pose.js";
import { MOTIONS } from "../../../../src/visuals/battle/weapons.js";

const poseOf = (state: EnemyState, t: number, k: number, attack: AttackKind, stroke = { set: k, turn: 0 }) =>
  koboldPose(state, t, k, attack, MOTIONS.sword, stroke);

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

  test("from the drive on the blade is exactly where its stroke is: straight ahead halfway", () => {
    const mid = poseOf("weapon", 0.06, 0.5, "lr", { set: 1, turn: 0.5 });
    assert.equal(mid.bladeExact, true);
    assert.ok(mid.blade.z > 0.9);
    assert.equal(poseOf("weaponWindup", 0.1, 0.2, "lr", { set: 1, turn: 0.1 }).bladeExact, true, "driven");
    assert.equal(poseOf("weaponWindup", 0.1, 0.2, "lr", { set: 0.5, turn: 0 }).bladeExact, false, "being set");
  });

  test("it follows through as it starts to recover, then eases to its recovery", () => {
    const following = poseOf("weaponRecover", 0.1, 0.1, "lr", { set: 1, turn: 0.9 });
    assert.equal(following.bladeExact, true);
    assert.ok(following.blade.x < -0.5, "on the swing's far side");
    assert.equal(koboldPose("weaponRecover", 0.5, 0.5, "lr", MOTIONS.sword, null).bladeExact, false);
  });

  test("dead it falls over; parried it sees stars", () => {
    assert.equal(poseOf("dead", 0, 0, "lr").roll, Math.PI / 2);
    assert.equal(poseOf("parried", 0.1, 0, "lr").stars, true);
  });
});
