import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Vec3 } from "@infinite-tower/shared";
import { reachArm } from "../../../src/visuals/battle/arm.js";

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const shoulder: Vec3 = { x: 0.25, y: 1.2, z: 0 };
const bones = { upperM: 0.4, foreM: 0.4 };
const down: Vec3 = { x: 0, y: -1, z: 0 };

describe("an arm's two-joint reach", () => {
  test("the hand lands on a target in reach, both bones keeping their length", () => {
    const target = { x: 0.3, y: 1.0, z: 0.5 };
    const { elbow, hand } = reachArm(shoulder, target, bones, down);
    assert.ok(dist(hand, target) < 1e-9);
    assert.ok(Math.abs(dist(shoulder, elbow) - bones.upperM) < 1e-9);
    assert.ok(Math.abs(dist(elbow, hand) - bones.foreM) < 1e-9);
  });

  test("the elbow bends toward its pole, not away", () => {
    const target = { x: 0.25, y: 1.2, z: 0.5 };
    assert.ok(reachArm(shoulder, target, bones, down).elbow.y < shoulder.y);
    assert.ok(reachArm(shoulder, target, bones, { x: 1, y: 0, z: 0 }).elbow.x > shoulder.x);
  });

  test("out of reach the arm points straight at the target, as far as it goes", () => {
    const target = { x: 0.25, y: 1.2, z: 2 };
    const { elbow, hand } = reachArm(shoulder, target, bones, down);
    assert.ok(Math.abs(dist(shoulder, hand) - (bones.upperM + bones.foreM)) < 1e-6);
    assert.ok(Math.abs(hand.x - shoulder.x) < 1e-9 && Math.abs(hand.y - shoulder.y) < 1e-9);
    assert.ok(Math.abs(elbow.y - shoulder.y) < 1e-3, "straight");
  });

  test("a target on the shoulder still gives a whole arm", () => {
    const { elbow, hand } = reachArm(shoulder, shoulder, bones, down);
    for (const v of [elbow.x, elbow.y, elbow.z, hand.x, hand.y, hand.z]) assert.ok(Number.isFinite(v));
    assert.ok(Math.abs(dist(shoulder, elbow) - bones.upperM) < 1e-9);
  });
});
