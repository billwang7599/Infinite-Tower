import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT } from "@infinite-tower/shared";
import {
  breathLiftTiles, glide, hopTiles, stepHop, stepped, type Glide,
} from "../../../src/visuals/overworld/motion.js";

const FRAME_TIME = 1 / 120;
const SNAP_TIME = 3 * FIXED_DT;

describe("a walker's hop", () => {
  test("stopping mid-hop lands it smoothly instead of snapping to the ground", () => {
    let phase = 0;
    for (let i = 0; i < 10; i++) phase = stepHop(phase, true, FRAME_TIME);
    let height = hopTiles(phase);
    assert.ok(height > 0);
    const heights: number[] = [height];
    for (let i = 0; i < 120 && phase !== 0; i++) {
      phase = stepHop(phase, false, FRAME_TIME);
      heights.push(height = hopTiles(phase));
    }
    assert.equal(phase, 0);
    for (let i = 1; i < heights.length; i++) assert.ok(Math.abs(heights[i]! - heights[i - 1]!) < 0.03, "no jump");
  });

  test("standing still doesn't hop", () => {
    assert.equal(stepHop(0, false, FRAME_TIME), 0);
  });
});

describe("drawing the local player between fixed steps", () => {
  test("goes evenly from the step before to the last one", () => {
    const from = { x: 0, z: 0 }, to = { x: 1, z: 2 };
    assert.deepEqual(stepped(from, to, 0.25), { x: 0.25, z: 0.5 });
    assert.deepEqual(stepped(from, to, 1), to);
  });
});

describe("gliding others between server snapshots", () => {
  const walkAt = (speed: number, frames: number) => {
    const g: Glide = { drawn: { x: 0, z: 0 }, last: { x: 0, z: 0 }, sinceSnapTime: 0 };
    const steps: number[] = [];
    let serverX = 0;
    for (let f = 0; f < frames; f++) {
      const t = f * FRAME_TIME;
      if (Math.floor(t / SNAP_TIME) !== Math.floor((t - FRAME_TIME) / SNAP_TIME)) serverX = speed * t;
      const before = g.drawn.x;
      glide(g, { x: serverX, z: 0 }, { vx: speed, vz: 0 }, FRAME_TIME);
      steps.push(g.drawn.x - before);
    }
    return { g, steps: steps.slice(frames / 2) };
  };

  test("someone walking steadily is drawn moving steadily, not in surges", () => {
    const { steps } = walkAt(4, 240);
    const mean = steps.reduce((a, b) => a + b) / steps.length;
    for (const s of steps) assert.ok(Math.abs(s - mean) < mean * 0.35, `step ${s} vs mean ${mean}`);
  });

  test("stays close behind where they really are", () => {
    const { g } = walkAt(4, 240);
    assert.ok(Math.abs(g.drawn.x - 4 * 239 * FRAME_TIME) < 0.4);
  });

  test("jumps straight to someone who teleported", () => {
    const g: Glide = { drawn: { x: 0, z: 0 }, last: { x: 0, z: 0 }, sinceSnapTime: 0 };
    glide(g, { x: 20, z: 0 }, { vx: 0, vz: 0 }, FRAME_TIME);
    assert.deepEqual(g.drawn, { x: 20, z: 0 });
  });
});

describe("standing breath", () => {
  test("lifts by whole sprite pixels only, and not at all while walking", () => {
    const pixel = 1.6 / 32;
    const lifts = new Set<number>();
    for (let t = 0; t < 5; t += 0.01) lifts.add(Math.round(breathLiftTiles(t, 0, 1.6, false) / pixel * 1000) / 1000);
    assert.deepEqual([...lifts].sort(), [0, 1]);
    assert.equal(breathLiftTiles(0.5, 0, 1.6, true), 0);
  });

  test("people standing together don't breathe in step", () => {
    const at = (seed: number) => Array.from({ length: 50 }, (_, i) => breathLiftTiles(i * 0.1, seed, 1.6, false));
    assert.notDeepEqual(at(1), at(2));
  });
});
