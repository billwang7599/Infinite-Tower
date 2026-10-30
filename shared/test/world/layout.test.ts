import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  faceToward, FIXED_DT, HEADING_WAY, inRect, mapHalfSize, moveWalker, nearCampfire, REST_RANGE_TILES, stepWalker,
  WALKER_RADIUS, type Vec2, type Velocity2,
} from "@infinite-tower/shared";
import { ROCKS, TEST_LAYOUT as level } from "./level.js";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

describe("stepWalker", () => {
  test("moves playerSpeed tiles per second and reports the velocity", () => {
    const pos: Vec2 = { x: 0, z: 0 }, vel: Velocity2 = { vx: 0, vz: 0 };
    stepWalker(level, pos, { moveX: 1, moveZ: 0 }, 0.5, { vel });
    close(pos.x, level.playerSpeed * 0.5);
    assert.equal(pos.z, 0);
    assert.deepEqual(vel, { vx: level.playerSpeed, vz: 0 });
  });

  test("at a slower pace (a heavy load), covers that share of the distance", () => {
    const pos: Vec2 = { x: 0, z: 0 }, vel: Velocity2 = { vx: 0, vz: 0 };
    stepWalker(level, pos, { moveX: 0, moveZ: 1 }, 0.5, { vel, pace: 0.5 });
    close(pos.z, level.playerSpeed * 0.25);
    assert.deepEqual(vel, { vx: 0, vz: level.playerSpeed * 0.5 });
  });

  test("diagonals are no faster than straight lines", () => {
    const pos: Vec2 = { x: 0, z: -4 };
    stepWalker(level, pos, { moveX: 1, moveZ: 1 }, 1);
    close(Math.hypot(pos.x, pos.z + 4), level.playerSpeed);
  });

  test("inputs past ±1 count as ±1 (a client can't send itself faster)", () => {
    const pos: Vec2 = { x: 0, z: 0 };
    stepWalker(level, pos, { moveX: 50, moveZ: 0 }, 0.1);
    close(pos.x, level.playerSpeed * 0.1);
  });

  test("stops at the map's edge", () => {
    const pos: Vec2 = { x: 0, z: 0 };
    for (let i = 0; i < 600; i++) stepWalker(level, pos, { moveX: 1, moveZ: -1 }, FIXED_DT);
    const { halfWidth, halfDepth } = mapHalfSize(level);
    close(pos.x, halfWidth - WALKER_RADIUS);
    close(pos.z, -(halfDepth - WALKER_RADIUS));
  });

  test("is deterministic: the same inputs end in the same place", () => {
    const walk = () => {
      const pos: Vec2 = { x: 1, z: -2 };
      for (let i = 0; i < 400; i++) {
        stepWalker(level, pos, { moveX: Math.sin(i * 0.1), moveZ: Math.cos(i * 0.07) }, FIXED_DT);
      }
      return pos;
    };
    assert.deepEqual(walk(), walk());
  });
});

describe("solid tiles", () => {
  test("a walker stops flush against one", () => {
    const pos: Vec2 = { x: -6, z: 2.5 };
    for (let i = 0; i < 120; i++) stepWalker(level, pos, { moveX: 1, moveZ: 0 }, FIXED_DT);
    close(pos.x, ROCKS.minX - WALKER_RADIUS);
    close(pos.z, 2.5);
  });

  test("walking into one at a slant slides along it", () => {
    const pos: Vec2 = { x: -4, z: 2 };
    stepWalker(level, pos, { moveX: 1, moveZ: 1 }, 0.4);
    close(pos.x, ROCKS.minX - WALKER_RADIUS);
    assert.ok(pos.z > 2, "still moved along the rocks");
  });

  test("slides past its corner and on", () => {
    const pos: Vec2 = { x: -4, z: 3.5 };
    for (let i = 0; i < 60; i++) stepWalker(level, pos, { moveX: 1, moveZ: 1 }, FIXED_DT);
    assert.ok(pos.z > ROCKS.maxZ + WALKER_RADIUS - 1e-9);
    assert.ok(pos.x > ROCKS.minX, "went on east once past the top");
  });

  test("a big step can't jump through", () => {
    const pos: Vec2 = { x: -6, z: 2.5 };
    stepWalker(level, pos, { moveX: 1, moveZ: 0 }, 2);
    close(pos.x, ROCKS.minX - WALKER_RADIUS);
  });

  test("the same holds from the other side and from above", () => {
    const east: Vec2 = { x: 0, z: 2.5 };
    moveWalker(level, east, -5, 0);
    close(east.x, ROCKS.maxX + WALKER_RADIUS);
    const north: Vec2 = { x: -2.5, z: 4.6 };
    moveWalker(level, north, 0, -3);
    close(north.z, ROCKS.maxZ + WALKER_RADIUS);
  });

  test("a walker caught inside one can walk out", () => {
    const pos: Vec2 = { x: -2.5, z: 2.5 };
    moveWalker(level, pos, 0.2, 0);
    close(pos.x, -2.3);
  });
});

test("inRect includes its edges", () => {
  const r = { x: 0, z: 0, w: 2, h: 1 };
  assert.ok(inRect(r, 0, 0) && inRect(r, 2, 1));
  assert.ok(!inRect(r, 2.01, 0.5));
});

describe("nearCampfire", () => {
  const fire = level.campfires[0]!;
  test("within REST_RANGE_TILES of a campfire", () => {
    assert.equal(nearCampfire(level, { x: fire.x + REST_RANGE_TILES, z: fire.z }), true);
    assert.equal(nearCampfire(level, { x: fire.x + REST_RANGE_TILES + 0.1, z: fire.z }), false);
  });
  test("slack reaches further", () => {
    assert.equal(nearCampfire(level, { x: fire.x + REST_RANGE_TILES + 0.1, z: fire.z }, 0.2), true);
  });
});

describe("faceToward: which way on the map an overworld walker faces", () => {
  test("walking straight turns to that way: +z is north, +x east", () => {
    assert.equal(faceToward("south", 1, 0), "east");
    assert.equal(faceToward("south", -1, 0), "west");
    assert.equal(faceToward("south", 0, 1), "north");
    assert.equal(faceToward("north", 0, -1), "south");
  });

  test("standing still, or barely moving, keeps the way it faced", () => {
    assert.equal(faceToward("north", 0, 0), "north");
    assert.equal(faceToward("west", 0.05, -0.05), "west");
  });

  test("on a diagonal it keeps facing a way it's still walking, so it doesn't flicker", () => {
    assert.equal(faceToward("north", -1, 1), "north");
    assert.equal(faceToward("west", -1, 1), "west");
    assert.equal(faceToward("south", 0.7, -0.7), "south");
  });

  test("turning onto a diagonal from elsewhere faces the stronger way, east or west on a tie", () => {
    assert.equal(faceToward("south", -1, 1), "west");
    assert.equal(faceToward("east", -0.4, 1), "north");
    assert.equal(faceToward("north", 1, -0.4), "east");
  });

  test("a sideways nudge under the dead zone doesn't count as walking that way", () => {
    assert.equal(faceToward("west", 0.05, 1), "north");
  });
});

describe("HEADING_WAY: the way a heading looks, on the ground", () => {
  test("+z is north and +x east, each one tile long", () => {
    assert.deepEqual(HEADING_WAY, {
      north: { x: 0, z: 1 }, east: { x: 1, z: 0 }, south: { x: 0, z: -1 }, west: { x: -1, z: 0 },
    });
  });
});
