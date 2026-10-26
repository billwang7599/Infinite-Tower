import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT, stepWalker } from "@infinite-tower/shared";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import type { LevelDef } from "../../../src/core/levels/level.js";
import { TEST_LEVEL } from "../../fixtures/level.js";
import { actors } from "./helpers.js";

/** No actors, so nothing can start a fight while the player walks. */
const EMPTY_LEVEL: LevelDef = { ...TEST_LEVEL, spawns: [] };

function overworldIn(level: LevelDef = EMPTY_LEVEL): Overworld {
  const overworld = new Overworld(() => assert.fail("no encounter expected"));
  overworld.enter(level);
  return overworld;
}

function sendInputs(overworld: Overworld, count: number, firstSeq = 1): void {
  for (let i = 0; i < count; i++) overworld.input(firstSeq + i, 1, 0);
}

function stepTicks(overworld: Overworld, ticks: number): void {
  for (let i = 0; i < ticks; i++) overworld.step(FIXED_DT);
}

describe("Overworld walking", () => {
  test("an input moves the player the way the shared walking rules do, and is acked", () => {
    const overworld = overworldIn();
    const expected = { ...EMPTY_LEVEL.spawn };
    stepWalker(EMPTY_LEVEL.layout, expected, { moveX: 1, moveZ: -1 }, FIXED_DT);

    overworld.input(1, 1, -1);
    overworld.step(FIXED_DT);

    assert.deepEqual(overworld.playerPos(), expected);
    assert.equal(overworld.playerData().ack, 1);
  });

  test("a straight step covers playerSpeed * FIXED_DT", () => {
    const overworld = overworldIn();
    overworld.input(1, 1, 0);
    overworld.step(FIXED_DT);
    const moved = overworld.playerPos().x - EMPTY_LEVEL.spawn.x;
    assert.ok(Math.abs(moved - EMPTY_LEVEL.layout.playerSpeed * FIXED_DT) < 1e-9);
  });

  test("older and repeated seqs are ignored", () => {
    const overworld = overworldIn();
    overworld.input(5, 1, 0);
    overworld.input(5, 1, 0);
    overworld.input(3, 1, 0);
    stepTicks(overworld, 5);
    assert.equal(overworld.playerData().ack, 5);
    const oneStep = EMPTY_LEVEL.layout.playerSpeed * FIXED_DT;
    assert.ok(Math.abs(overworld.playerPos().x - (EMPTY_LEVEL.spawn.x + oneStep)) < 1e-9);
  });

  test("one input is simulated per tick", () => {
    const overworld = overworldIn();
    sendInputs(overworld, 100);
    stepTicks(overworld, 10);
    assert.equal(overworld.playerData().ack, 10);
  });

  test("after a stall it catches up several inputs in a tick, but not a whole backlog", () => {
    const overworld = overworldIn();
    stepTicks(overworld, 60);
    sendInputs(overworld, 20);
    overworld.step(FIXED_DT);
    const ack = overworld.playerData().ack;
    assert.ok(ack > 1, `caught up ${ack}`);
    assert.ok(ack < 20, `caught up ${ack}`);
  });

  test("a flood of inputs can't move the player faster: most of it is dropped", () => {
    const overworld = overworldIn();
    sendInputs(overworld, 100);
    stepTicks(overworld, 200);
    const simulated = overworld.playerData().ack;
    assert.ok(simulated < 50, `simulated ${simulated} of 100`);
    assert.equal(overworld.playerData().queue.length, 0);
  });

  test("resetWalk drops queued inputs and makes the player safe for a while", () => {
    const overworld = overworldIn();
    sendInputs(overworld, 10);
    overworld.resetWalk(1.5);
    const walk = overworld.playerData();
    assert.equal(walk.queue.length, 0);
    assert.equal(walk.credits, 0);
    assert.equal(walk.grassDist, 0);
    assert.equal(walk.safeTime, 1.5);
    const before = overworld.playerPos();
    overworld.step(FIXED_DT);
    assert.deepEqual(overworld.playerPos(), before);
  });

  test("safeTime runs down with game time", () => {
    const overworld = overworldIn();
    overworld.resetWalk(1);
    stepTicks(overworld, 30);
    assert.ok(Math.abs(overworld.playerData().safeTime - 0.5) < 1e-9);
    stepTicks(overworld, 60);
    assert.equal(overworld.playerData().safeTime, 0);
  });
});

describe("Overworld levels", () => {
  test("the level can't be read before entering one", () => {
    const overworld = new Overworld(() => {});
    assert.equal(overworld.hasLevel, false);
    assert.throws(() => overworld.level);
  });

  test("entering puts the player at the spawn and spawns the level's actors", () => {
    const overworld = new Overworld(() => {});
    overworld.enter(TEST_LEVEL);
    assert.equal(overworld.hasLevel, true);
    assert.equal(overworld.level, TEST_LEVEL);
    assert.deepEqual(overworld.playerPos(), TEST_LEVEL.spawn);
    assert.equal(actors(overworld.world).length, TEST_LEVEL.spawns.length);
  });

  test("entering again replaces the old actors instead of adding to them", () => {
    const overworld = new Overworld(() => {});
    overworld.enter(TEST_LEVEL);
    const [old] = actors(overworld.world);
    overworld.place({ x: 0, z: 0 });
    overworld.enter(TEST_LEVEL);
    assert.equal(actors(overworld.world).length, TEST_LEVEL.spawns.length);
    assert.equal(overworld.world.isAlive(old!), false);
    assert.deepEqual(overworld.playerPos(), TEST_LEVEL.spawn);
  });

  test("place moves the player without simulating", () => {
    const overworld = overworldIn();
    overworld.place({ x: 3, z: -4 });
    assert.deepEqual(overworld.playerPos(), { x: 3, z: -4 });
    assert.equal(overworld.playerData().ack, 0);
  });
});
