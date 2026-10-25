import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT } from "@infinite-tower/shared";
import { FixedClock } from "../../../src/core/game/clock.js";

function countingClock() {
  const steps: number[] = [];
  return { steps, clock: new FixedClock((dt) => steps.push(dt)) };
}

describe("FixedClock", () => {
  test("steps in fixed steps of FIXED_DT", () => {
    const { steps, clock } = countingClock();
    clock.advance(FIXED_DT * 3.5);
    assert.equal(steps.length, 3);
    assert.ok(steps.every((dt) => dt === FIXED_DT));
  });

  test("doesn't step before a whole step has passed", () => {
    const { steps, clock } = countingClock();
    clock.advance(FIXED_DT * 0.6);
    assert.equal(steps.length, 0);
  });

  test("carries leftover time into the next advance", () => {
    const { steps, clock } = countingClock();
    clock.advance(FIXED_DT * 1.6);
    assert.equal(steps.length, 1);
    clock.advance(FIXED_DT * 0.5);
    assert.equal(steps.length, 2);
  });

  test("after a long stall, catches up at most a quarter second", () => {
    const { steps, clock } = countingClock();
    clock.advance(10);
    assert.ok(steps.length > 0);
    assert.ok(steps.length * FIXED_DT <= 0.25 + 1e-9, `stepped ${steps.length} times`);
  });

  test("a stall's dropped time isn't made up later", () => {
    const { steps, clock } = countingClock();
    clock.advance(10);
    const afterStall = steps.length;
    clock.advance(FIXED_DT * 0.5);
    assert.ok(steps.length <= afterStall + 1);
  });
});
