import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AttackKind, EnemyState } from "@infinite-tower/shared";
import { koboldPose } from "../../../../src/visuals/enemies/kobold-swordsman/pose.js";
import { MOTIONS } from "../../../../src/visuals/battle/weapons.js";

const poseOf = (state: EnemyState, t: number, k: number, attack: AttackKind, stroke = { set: k, turn: 0 }) =>
  koboldPose(state, t, k, attack, MOTIONS.sword, stroke);

describe("the kobold's pose", () => {
  test("a swing's wind-up turns the blade to where the swing starts: its only tell", () => {
    assert.ok(poseOf("weaponWindup", 1, 1, "lr").blade.x > 0.5);
  });

  test("a stab's wind-up draws the hand back", () => {
    assert.ok(poseOf("weaponWindup", 1, 1, "stab").hand.z < poseOf("approach", 0, 0, "stab").hand.z);
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

  test("the sword hand goes with the blade: out to the side wound up, ahead mid-cut", () => {
    const guard = poseOf("approach", 0, 0, "lr"), wound = poseOf("weaponWindup", 1, 1, "lr");
    const mid = poseOf("weapon", 0.06, 0.5, "lr", { set: 1, turn: 0.5 });
    assert.ok(wound.hand.x > guard.hand.x);
    assert.ok(mid.hand.z > wound.hand.z);
  });

  test("the body leads the blade: coiled wound up, already turned the swing's way mid-cut, carried past it", () => {
    const wound = poseOf("weaponWindup", 1, 1, "lr");
    const mid = poseOf("weapon", 0.06, 0.5, "lr", { set: 1, turn: 0.5 });
    const past = poseOf("weaponRecover", 0.1, 0.1, "lr", { set: 1, turn: 1.1 });
    assert.ok(wound.twist > 0 && wound.hipTwist > 0);
    assert.ok(Math.abs(mid.blade.x) < 0.2, "the blade is only straight ahead");
    assert.ok(mid.twist < 0 && mid.hipTwist < 0, "the body is already turned past it");
    assert.ok(past.twist < mid.twist);
  });

  test("dead it falls over; parried it sees stars", () => {
    assert.equal(poseOf("dead", 0, 0, "lr").roll, Math.PI / 2);
    assert.equal(poseOf("parried", 0.1, 0, "lr").stars, true);
  });
});
