import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";
import { reachArm, reachRound, type Clearance } from "../../../src/visuals/battle/arm.js";
import { ROUNDNESS } from "../../../src/visuals/battle/person/loft.js";
import { alongSegment, depthIn } from "../../fixtures/clearance.js";

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

describe("an arm reaching round a body", () => {
  const scene = new Scene(new NullEngine()), trunk = new TransformNode("trunk", scene);
  trunk.computeWorldMatrix(true);
  const sections = [{ y: 0.6, x: 0.15, z: 0.12 }, { y: 1.3, x: 0.15, z: 0.12 }];
  const body = [{ node: trunk, roundness: ROUNDNESS, sections }];
  const c: Clearance = { body, upperM: 0.04, foreM: 0.035, handM: 0.04, upperFrom: 0.4 };
  const at = (v: Vec3) => new Vector3(v.x, v.y, v.z);
  const shoulderAt = new Vector3(0.2, 1.25, 0), pole = new Vector3(0.5, -0.8, -0.45), ahead = new Vector3(0, 0, 1);
  const short = { upperM: 0.2, foreM: 0.2 };
  const armIn = (elbow: Vec3, hand: Vec3) => Math.max(
    ...alongSegment(Vector3.Lerp(shoulderAt, at(elbow), c.upperFrom), at(elbow), 8)
      .map((p) => depthIn(body, p, c.upperM)),
    ...alongSegment(at(elbow), at(hand), 8).map((p) => depthIn(body, p, c.foreM)),
    depthIn(body, at(hand), c.handM),
  );

  test("a hand aimed inside the body comes out onto it, the arm bent round outside", () => {
    const { elbow, hand } = reachRound(shoulderAt, new Vector3(0, 1, 0.02), short, pole, c, ahead);
    assert.equal(depthIn(body, at(hand)), 0);
    assert.ok(armIn(elbow, hand) < 1e-3, `${armIn(elbow, hand)}`);
  });

  test("a blade pointing through the body moves the hand across, off its line", () => {
    const way = new Vector3(-0.6, 0, -0.8), blade = { fromM: 0.1, toM: 0.9, halfM: 0.04, way };
    const { elbow, hand } = reachRound(shoulderAt, new Vector3(0.02, 1, 0.2), short, pole, c, ahead, blade);
    const edge = alongSegment(at(hand).add(way.scale(blade.fromM)), at(hand).add(way.scale(blade.toM)), 16);
    assert.ok(Math.max(...edge.map((p) => depthIn(body, p, blade.halfM))) < 1e-3);
    assert.ok(armIn(elbow, hand) < 1e-3);
  });

  test("a hand it can't reach round the body stops short, out in front", () => {
    const { elbow, hand } = reachRound(shoulderAt, new Vector3(-0.3, 1.1, -0.05), short, pole, c, ahead);
    assert.ok(armIn(elbow, hand) < 1e-3);
    assert.ok(hand.z > 0, "in front");
  });
});
