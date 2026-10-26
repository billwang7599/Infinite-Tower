import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  FIXED_DT, inRect, inTallGrass, nearCampfire, REST_RANGE, stepWalker, type Vec2, type Velocity2,
} from "@infinite-tower/shared";
import { TEST_LAYOUT as level } from "./level.js";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

describe("stepWalker", () => {
  test("moves playerSpeed tiles per second and reports the velocity", () => {
    const pos: Vec2 = { x: 0, z: 0 }, vel: Velocity2 = { vx: 0, vz: 0 };
    stepWalker(level, pos, { moveX: 1, moveZ: 0 }, 0.5, { vel });
    assert.deepEqual(pos, { x: level.playerSpeed * 0.5, z: 0 });
    assert.deepEqual(vel, { vx: level.playerSpeed, vz: 0 });
  });

  test("at a slower pace (a heavy load), covers that share of the distance", () => {
    const pos: Vec2 = { x: 0, z: 0 }, vel: Velocity2 = { vx: 0, vz: 0 };
    stepWalker(level, pos, { moveX: 0, moveZ: 1 }, 0.5, { vel, pace: 0.5 });
    assert.deepEqual(pos, { x: 0, z: level.playerSpeed * 0.25 });
    assert.deepEqual(vel, { vx: 0, vz: level.playerSpeed * 0.5 });
  });

  test("diagonals are no faster than straight lines", () => {
    const pos: Vec2 = { x: 0, z: 0 };
    stepWalker(level, pos, { moveX: 1, moveZ: 1 }, 1);
    close(Math.hypot(pos.x, pos.z), level.playerSpeed);
  });

  test("inputs past ±1 count as ±1 (a client can't send itself faster)", () => {
    const pos: Vec2 = { x: 0, z: 0 };
    stepWalker(level, pos, { moveX: 50, moveZ: 0 }, 0.1);
    close(pos.x, level.playerSpeed * 0.1);
  });

  test("stops at the border", () => {
    const pos: Vec2 = { x: 0, z: 0 };
    for (let i = 0; i < 600; i++) stepWalker(level, pos, { moveX: -1, moveZ: 1 }, FIXED_DT);
    assert.deepEqual(pos, { x: -(level.halfWidth - level.border), z: level.halfDepth - level.border });
  });

  test("is deterministic: the same inputs end in the same place", () => {
    const walk = () => {
      const pos: Vec2 = { x: 1, z: -2 };
      for (let i = 0; i < 100; i++) stepWalker(level, pos, { moveX: Math.sin(i), moveZ: Math.cos(i * 0.7) }, FIXED_DT);
      return pos;
    };
    assert.deepEqual(walk(), walk());
  });
});

test("inRect includes its edges", () => {
  const r = { x: 0, z: 0, w: 2, h: 1 };
  assert.ok(inRect(r, 0, 0) && inRect(r, 2, 1));
  assert.ok(!inRect(r, 2.01, 0.5));
});

test("inTallGrass", () => {
  assert.equal(inTallGrass(level, 3, 0), true);
  assert.equal(inTallGrass(level, 0, 0), false);
});

describe("nearCampfire", () => {
  const fire = level.campfires[0]!;
  test("within REST_RANGE of a campfire", () => {
    assert.equal(nearCampfire(level, { x: fire.x + REST_RANGE, z: fire.z }), true);
    assert.equal(nearCampfire(level, { x: fire.x + REST_RANGE + 0.1, z: fire.z }), false);
  });
  test("slack reaches further", () => {
    assert.equal(nearCampfire(level, { x: fire.x + REST_RANGE + 0.1, z: fire.z }, 0.2), true);
  });
});
