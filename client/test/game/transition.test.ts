import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { startTransition, stepTransition, type Mode } from "../../src/game/transition.js";

const DT = 1 / 60;

/** Every frame of a whole transition, stepped at 60 fps. */
function run(to: Mode) {
  const tr = startTransition(to);
  const frames = [];
  for (let i = 0; i < 600; i++) {
    const frame = stepTransition(tr, DT);
    frames.push(frame);
    if (frame.done) break;
  }
  return frames;
}

describe("transition", () => {
  for (const to of ["battle", "field"] as const) {
    test(`into ${to}: the mode switches exactly once, on a fully covered screen`, () => {
      const frames = run(to);
      const swaps = frames.filter((f) => f.swapNow);
      assert.equal(swaps.length, 1);
      assert.equal(swaps[0]!.color, "#000");
      assert.ok(swaps[0]!.opacity > 0.95);
    });

    test(`into ${to}: it ends, clear, after the switch, in under two seconds`, () => {
      const frames = run(to);
      const last = frames.at(-1)!;
      assert.equal(last.done, true);
      assert.equal(last.opacity, 0);
      assert.ok(frames.length * DT < 2);
      assert.ok(frames.findIndex((f) => f.swapNow) < frames.length - 1);
    });

    test(`into ${to}: opacity stays between 0 and 1`, () => {
      for (const f of run(to)) assert.ok(f.opacity >= 0 && f.opacity <= 1);
    });
  }

  test("into battle starts with white flashes, on and off", () => {
    const frames = run("battle").slice(0, 20);
    assert.ok(frames.every((f) => f.color === "#fff"));
    assert.ok(frames.some((f) => f.opacity === 0) && frames.some((f) => f.opacity > 0));
  });

  test("back to the field fades through black, with no flashes", () => {
    assert.ok(run("field").every((f) => f.color === "#000"));
  });

  test("a long stalled frame still switches the mode once and ends", () => {
    const tr = startTransition("battle");
    const frame = stepTransition(tr, 5);
    assert.deepEqual(frame, { color: "#000", opacity: 0, swapNow: true, done: true });
    assert.equal(stepTransition(tr, DT).swapNow, false);
  });
});
