import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT, stepWalker } from "@infinite-tower/shared";
import { Field } from "../../../src/core/field/field.js";
import type { LevelDef } from "../../../src/core/levels/level.js";
import { TEST_LEVEL } from "../../fixtures/level.js";
import { actors } from "./helpers.js";

/** No actors, so nothing can start a fight while the player walks. */
const EMPTY_LEVEL: LevelDef = { ...TEST_LEVEL, spawns: [] };

function fieldIn(level: LevelDef = EMPTY_LEVEL): Field {
  const field = new Field(() => assert.fail("no encounter expected"));
  field.enter(level);
  return field;
}

function sendInputs(field: Field, count: number, firstSeq = 1): void {
  for (let i = 0; i < count; i++) field.input(firstSeq + i, 1, 0);
}

function stepTicks(field: Field, ticks: number): void {
  for (let i = 0; i < ticks; i++) field.step(FIXED_DT);
}

describe("Field walking", () => {
  test("an input moves the player the way the shared walking rules do, and is acked", () => {
    const field = fieldIn();
    const expected = { ...EMPTY_LEVEL.spawn };
    stepWalker(EMPTY_LEVEL.layout, expected, { moveX: 1, moveZ: -1 }, FIXED_DT);

    field.input(1, 1, -1);
    field.step(FIXED_DT);

    assert.deepEqual(field.playerPos(), expected);
    assert.equal(field.playerData().ack, 1);
  });

  test("a straight step covers playerSpeed * FIXED_DT", () => {
    const field = fieldIn();
    field.input(1, 1, 0);
    field.step(FIXED_DT);
    const moved = field.playerPos().x - EMPTY_LEVEL.spawn.x;
    assert.ok(Math.abs(moved - EMPTY_LEVEL.layout.playerSpeed * FIXED_DT) < 1e-9);
  });

  test("older and repeated seqs are ignored", () => {
    const field = fieldIn();
    field.input(5, 1, 0);
    field.input(5, 1, 0);
    field.input(3, 1, 0);
    stepTicks(field, 5);
    assert.equal(field.playerData().ack, 5);
    const oneStep = EMPTY_LEVEL.layout.playerSpeed * FIXED_DT;
    assert.ok(Math.abs(field.playerPos().x - (EMPTY_LEVEL.spawn.x + oneStep)) < 1e-9);
  });

  test("one input is simulated per tick", () => {
    const field = fieldIn();
    sendInputs(field, 100);
    stepTicks(field, 10);
    assert.equal(field.playerData().ack, 10);
  });

  test("after a stall it catches up several inputs in a tick, but not a whole backlog", () => {
    const field = fieldIn();
    stepTicks(field, 60);
    sendInputs(field, 20);
    field.step(FIXED_DT);
    const ack = field.playerData().ack;
    assert.ok(ack > 1, `caught up ${ack}`);
    assert.ok(ack < 20, `caught up ${ack}`);
  });

  test("a flood of inputs can't move the player faster: most of it is dropped", () => {
    const field = fieldIn();
    sendInputs(field, 100);
    stepTicks(field, 200);
    const simulated = field.playerData().ack;
    assert.ok(simulated < 50, `simulated ${simulated} of 100`);
    assert.equal(field.playerData().queue.length, 0);
  });

  test("resetWalk drops queued inputs and makes the player safe for a while", () => {
    const field = fieldIn();
    sendInputs(field, 10);
    field.resetWalk(1.5);
    const fp = field.playerData();
    assert.equal(fp.queue.length, 0);
    assert.equal(fp.credits, 0);
    assert.equal(fp.grassDist, 0);
    assert.equal(fp.safeTime, 1.5);
    const before = field.playerPos();
    field.step(FIXED_DT);
    assert.deepEqual(field.playerPos(), before);
  });

  test("safeTime runs down with game time", () => {
    const field = fieldIn();
    field.resetWalk(1);
    stepTicks(field, 30);
    assert.ok(Math.abs(field.playerData().safeTime - 0.5) < 1e-9);
    stepTicks(field, 60);
    assert.equal(field.playerData().safeTime, 0);
  });
});

describe("Field levels", () => {
  test("the level can't be read before entering one", () => {
    const field = new Field(() => {});
    assert.equal(field.hasLevel, false);
    assert.throws(() => field.level);
  });

  test("entering puts the player at the spawn and spawns the level's actors", () => {
    const field = new Field(() => {});
    field.enter(TEST_LEVEL);
    assert.equal(field.hasLevel, true);
    assert.equal(field.level, TEST_LEVEL);
    assert.deepEqual(field.playerPos(), TEST_LEVEL.spawn);
    assert.equal(actors(field.world).length, TEST_LEVEL.spawns.length);
  });

  test("entering again replaces the old actors instead of adding to them", () => {
    const field = new Field(() => {});
    field.enter(TEST_LEVEL);
    const [old] = actors(field.world);
    field.place({ x: 0, z: 0 });
    field.enter(TEST_LEVEL);
    assert.equal(actors(field.world).length, TEST_LEVEL.spawns.length);
    assert.equal(field.world.isAlive(old!), false);
    assert.deepEqual(field.playerPos(), TEST_LEVEL.spawn);
  });

  test("place moves the player without simulating", () => {
    const field = fieldIn();
    field.place({ x: 3, z: -4 });
    assert.deepEqual(field.playerPos(), { x: 3, z: -4 });
    assert.equal(field.playerData().ack, 0);
  });
});
