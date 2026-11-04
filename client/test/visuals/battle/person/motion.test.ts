import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { HAIR_SWAY, STILL_HAIR, swayHair, type Sway } from "../../../../src/visuals/battle/person/motion.js";

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
