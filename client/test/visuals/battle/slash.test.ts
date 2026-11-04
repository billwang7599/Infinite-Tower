import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { newTrail, sampleTrail, trailAlpha, TRAIL_TIME } from "../../../src/visuals/battle/slash.js";

const edge = (x: number) => ({ base: { x, y: 0, z: 0 }, tip: { x, y: 1, z: 0 } });
const FRAME = 1 / 60;

describe("a swing's trail", () => {
  test("keeps where the blade was over the last moment, newest last", () => {
    const trail = newTrail(), { samples } = trail;
    for (let i = 0; i < 60; i++) sampleTrail(trail, i * FRAME, edge(i), 1);
    const now = 59 * FRAME;
    assert.equal(samples.at(-1)!.base.x, 59);
    assert.ok(samples.every((s) => now - s.time <= TRAIL_TIME + 1e-9));
    assert.ok(now - samples[0]!.time > TRAIL_TIME - 2 * FRAME, "as far back as it goes");
  });

  test("fades from the newest to nothing at its end, as faint as the swing is", () => {
    const trail = newTrail(), { samples } = trail;
    for (let i = 0; i < 10; i++) sampleTrail(trail, i * FRAME, edge(i), 0.5);
    const now = 9 * FRAME, alphas = samples.map((s) => trailAlpha(s, now));
    assert.equal(alphas.at(-1), 0.5);
    assert.deepEqual(alphas, [...alphas].sort((a, b) => a - b));
    assert.equal(trailAlpha(samples[0]!, samples[0]!.time + TRAIL_TIME), 0);
  });

  test("with no swing it adds nothing and the rest fades away", () => {
    const trail = newTrail(), { samples } = trail;
    for (let i = 0; i < 5; i++) sampleTrail(trail, i * FRAME, edge(i), 1);
    sampleTrail(trail, 5 * FRAME, null, 1);
    assert.equal(samples.length, 5);
    sampleTrail(trail, 4 * FRAME + TRAIL_TIME + FRAME, null, 1);
    assert.equal(samples.length, 0);
  });

  test("a new swing starts its own trail, not joined to the last", () => {
    const trail = newTrail(), { samples } = trail;
    for (let i = 0; i < 5; i++) sampleTrail(trail, i * FRAME, edge(i), 1);
    sampleTrail(trail, 5 * FRAME, null, 1);
    sampleTrail(trail, 6 * FRAME, edge(100), 1);
    assert.deepEqual(samples.map((s) => s.base.x), [100]);
  });
});
