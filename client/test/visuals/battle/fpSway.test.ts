import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FP_SWAY, newFpSway, swayArms, type SwayInput } from "../../../src/visuals/battle/fpSway.js";

const FRAME_TIME = 1 / 60;
const STRIDES_PER_SEC = 1.5;
const still: SwayInput = { speed: 0, stridePhase: 0, grounded: true, free: true, yaw: 0, pitch: 0 };
const run = (frames: number, at: (i: number) => Partial<SwayInput>, sway = newFpSway()) => {
  const out = [];
  for (let i = 0; i < frames; i++) out.push(swayArms(sway, { ...still, ...at(i) }, FRAME_TIME));
  return out;
};
const walked = (frame: number) => 2 * Math.PI * STRIDES_PER_SEC * frame * FRAME_TIME;
const most = (xs: number[]) => Math.max(...xs.map(Math.abs));

describe("first person's arms sway with the body, never with the fight", () => {
  test("standing, they only breathe, barely", () => {
    const moved = run(300, () => ({}));
    assert.ok(most(moved.map((m) => m.y)) > 0, "they breathe");
    assert.ok(most(moved.flatMap((m) => [m.x, m.y, m.z])) <= FP_SWAY.breathM + 1e-9);
  });

  test("walking, they bob up and down twice a stride and side to side once, eased in", () => {
    const moved = run(240, (i) => ({ speed: FP_SWAY.fullSpeed, stridePhase: walked(i) }));
    assert.ok(Math.abs(moved[0]!.y) < FP_SWAY.bobM.y / 4, "not at full bob the first frame");
    const settled = moved.slice(120);
    assert.ok(most(settled.map((m) => m.x)) > FP_SWAY.bobM.x * 0.8);
    assert.ok(most(settled.map((m) => m.y)) > FP_SWAY.bobM.y * 0.8);
    for (let i = 1; i < moved.length; i++) {
      assert.ok(Math.hypot(moved[i]!.x - moved[i - 1]!.x, moved[i]!.y - moved[i - 1]!.y) < 0.004, `frame ${i}`);
    }
  });

  test("turning, they trail behind the view and come back when it stops", () => {
    const turnRadPerSec = 3, moved = run(120, (i) => ({ yaw: Math.min(i, 60) * turnRadPerSec * FRAME_TIME }));
    assert.ok(moved[50]!.x < -FP_SWAY.lagM / 4, "turning right, they trail left");
    assert.ok(Math.abs(moved[50]!.x) <= FP_SWAY.lagM + FP_SWAY.breathM);
    assert.ok(Math.abs(moved[119]!.x) < FP_SWAY.lagM / 10, "back once it stops");
  });

  test("a swing, a guard or the air fades it out, so a cut goes where it's aimed", () => {
    const sway = newFpSway();
    run(120, (i) => ({ speed: FP_SWAY.fullSpeed, stridePhase: walked(i) }), sway);
    const swinging = run(60, (i) => ({ speed: FP_SWAY.fullSpeed, stridePhase: walked(i), free: false }), sway);
    assert.ok(most(swinging.slice(30).flatMap((m) => [m.x, m.y])) < 0.001);
    const flying = run(60, (i) => ({ speed: FP_SWAY.fullSpeed, stridePhase: walked(i), grounded: false }));
    assert.ok(most(flying.slice(30).map((m) => m.x)) < 0.001);
  });

  test("a view snapped round (a new fight, a lock-on jump) doesn't fling them", () => {
    const moved = run(10, (i) => ({ yaw: i < 5 ? 0 : 3 }));
    assert.ok(most(moved.map((m) => m.x)) <= FP_SWAY.lagM + FP_SWAY.breathM);
  });
});
