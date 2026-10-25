import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  approach, clamp, damp, distXZ, roundTo, seededRandom, turnToward, wrapAngle,
} from "@infinite-tower/shared";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

describe("approach", () => {
  test("moves by at most maxDelta, either way", () => {
    assert.equal(approach(0, 10, 3), 3);
    assert.equal(approach(10, 0, 3), 7);
  });
  test("stops on the target instead of overshooting", () => {
    assert.equal(approach(9, 10, 3), 10);
    assert.equal(approach(1, 0, 3), 0);
  });
});

test("clamp", () => {
  assert.equal(clamp(-1, 0, 5), 0);
  assert.equal(clamp(9, 0, 5), 5);
  assert.equal(clamp(3, 0, 5), 3);
});

describe("angles", () => {
  test("wrapAngle lands in (-π, π]", () => {
    close(wrapAngle(3 * Math.PI), Math.PI);
    close(wrapAngle(-Math.PI / 2 - 2 * Math.PI), -Math.PI / 2);
  });
  test("turnToward goes the short way round, by at most maxStep", () => {
    // From just below +π to just above -π is a small step across the seam, not a full turn back.
    close(turnToward(3, -3, 1), 3 + (2 * Math.PI - 6));
    close(turnToward(0, 2, 0.5), 0.5);
    close(turnToward(0, -2, 0.5), -0.5);
  });
});

describe("damp", () => {
  test("closes part of the gap, never overshooting", () => {
    const x = damp(0, 10, 5, 1 / 60);
    assert.ok(x > 0 && x < 10);
  });
  test("doesn't depend on frame rate: two half steps equal one whole step", () => {
    close(damp(damp(0, 10, 5, 0.05), 10, 5, 0.05), damp(0, 10, 5, 0.1));
  });
});

test("roundTo", () => {
  assert.equal(roundTo(1.23456, 2), 1.23);
  assert.equal(roundTo(12.5, 0), 13);
});

test("distXZ ignores nothing but y", () => {
  assert.equal(distXZ({ x: 0, z: 0 }, { x: 3, z: 4 }), 5);
});

describe("seededRandom", () => {
  test("the same seed gives the same sequence", () => {
    const a = seededRandom(42), b = seededRandom(42);
    for (let i = 0; i < 5; i++) assert.equal(a(), b());
  });
  test("returns numbers in [0, 1)", () => {
    const rng = seededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const r = rng();
      assert.ok(r >= 0 && r < 1);
    }
  });
});
