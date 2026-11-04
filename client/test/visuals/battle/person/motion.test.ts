import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Matrix, Vector3 } from "@babylonjs/core";
import { PLAYER } from "@infinite-tower/shared";
import {
  footOnStride, HAIR_SWAY, legAngles, STILL_HAIR, STRIDE, strideOf, swayHair, type Sway,
} from "../../../../src/visuals/battle/person/motion.js";

const DOWN = { x: 0, y: -1, z: 0 }, STILL = { x: 0, y: 0, z: 0 };
const run = (down: typeof DOWN, accel: typeof STILL, time: number, from: Sway = STILL_HAIR): Sway => {
  let s = from;
  for (let t = 0; t < time; t += 1 / 60) s = swayHair(s, down, accel, 1 / 60);
  return s;
};

describe("the hair's swing", () => {
  test("hangs still from a still, upright head", () => {
    assert.deepEqual(run(DOWN, STILL, 1), { x: 0, z: 0, vx: 0, vz: 0 });
  });

  test("trails behind a head that speeds ahead, and to the left of one going right", () => {
    const ahead = run(DOWN, { x: 0, y: 0, z: 20 }, 0.1), right = run(DOWN, { x: 20, y: 0, z: 0 }, 0.1);
    assert.ok(ahead.x > 0, "swung back (+x turns the hanging hair to −z)");
    assert.ok(right.z < 0, "swung left (−z turns it to −x)");
  });

  test("swings past and settles back once the head stops, never further than its limit", () => {
    const swung = run(DOWN, { x: 0, y: 0, z: 200 }, 0.5);
    assert.ok(swung.x <= HAIR_SWAY.maxRad + 1e-9);
    let s = swung, least = swung.x;
    for (let i = 0; i < 30; i++) least = Math.min(least, (s = swayHair(s, DOWN, STILL, 1 / 60)).x);
    assert.ok(least < 0, "overshoots forward");
    const settled = run(DOWN, STILL, 3, swung);
    assert.ok(Math.abs(settled.x) < 0.01);
  });

  test("keeps hanging down when the head tilts back", () => {
    const tilted = { x: 0, y: -Math.cos(0.5), z: -Math.sin(0.5) };
    assert.ok(run(tilted, STILL, 2).x > 0.3);
  });
});

describe("the stride", () => {
  const T = 0.17, S = 0.16;
  const ankleOf = (a: ReturnType<typeof legAngles>) => {
    const shin = Vector3.TransformCoordinates(new Vector3(0, -S, 0), Matrix.RotationYawPitchRoll(0, a.shinX, 0));
    return Vector3.TransformCoordinates(new Vector3(0, -T, 0).addInPlace(shin),
      Matrix.RotationYawPitchRoll(0, a.thighX, a.thighZ));
  };

  test("a leg reaches the ankle to where it's asked, the knee bent forward", () => {
    for (const to of [{ x: 0, y: -0.3, z: 0.1 }, { x: 0.06, y: -0.25, z: -0.12 }, { x: -0.05, y: -0.2, z: 0 }]) {
      const a = legAngles(to, T, S), at = ankleOf(a);
      assert.ok(Math.hypot(at.x - to.x, at.y - to.y, at.z - to.z) < 1e-6, `${JSON.stringify(to)}: ${at}`);
      assert.ok(a.shinX > 0, "the knee bends forward, the shin back");
    }
    const far = ankleOf(legAngles({ x: 0, y: -1, z: 0 }, T, S));
    assert.ok(Math.abs(far.y + T + S) < 1e-3, "out of reach, it stretches straight toward it");
  });

  test("the planted foot sweeps back at the ground's speed, so it stays put", () => {
    for (const speed of [1, 3, PLAYER.moveSpeed]) {
      const s = strideOf(speed, 0), dShare = 1e-4;
      const along = (share: number) => footOnStride(share, s).along;
      const sweepPerSec = ((along(s.duty / 2 - dShare) - along(s.duty / 2 + dShare)) / (2 * dShare)) * s.cyclesPerSec;
      assert.ok(Math.abs(sweepPerSec - speed) < 1e-6, `${speed} m/s: swept at ${sweepPerSec}`);
      assert.equal(footOnStride(s.duty / 2, s).lift, 0, "down");
      assert.ok(footOnStride((1 + s.duty) / 2, s).lift > 0, "lifted on its way forward");
      assert.ok(s.duty > 0 && s.duty < 1);
    }
  });

  test("faster is longer and quicker strides with less time down; sideways steps are shorter", () => {
    const walk = strideOf(1.5, 0), run = strideOf(PLAYER.moveSpeed, 0);
    assert.ok(run.halfM > walk.halfM && run.cyclesPerSec > walk.cyclesPerSec && run.duty < walk.duty);
    assert.ok(run.halfM <= STRIDE.halfM + 1e-9);
    assert.ok(strideOf(PLAYER.moveSpeed, 1).halfM < run.halfM);
    assert.equal(strideOf(0, 0).cyclesPerSec, 0);
  });
});
