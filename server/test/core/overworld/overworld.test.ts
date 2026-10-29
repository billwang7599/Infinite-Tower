import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT, stepWalker, type Entity } from "@infinite-tower/shared";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import type { LevelDef } from "../../../src/core/world/level.js";
import { TEST_CHARACTER, TEST_LEVEL } from "../../fixtures/level.js";
import { actors } from "./helpers.js";

/** No actors, so nothing can start a fight while the player walks. */
const EMPTY_LEVEL: LevelDef = { ...TEST_LEVEL, spawns: [] };

function overworldIn(level: LevelDef = EMPTY_LEVEL): { overworld: Overworld; me: Entity } {
  const overworld = new Overworld(level);
  return { overworld, me: overworld.join(TEST_CHARACTER, () => assert.fail("no encounter expected")) };
}

function sendInputs({ overworld, me }: { overworld: Overworld; me: Entity }, count: number, firstSeq = 1): void {
  for (let i = 0; i < count; i++) overworld.input(me, firstSeq + i, 1, 0);
}

function stepTicks(overworld: Overworld, ticks: number): void {
  for (let i = 0; i < ticks; i++) overworld.step(FIXED_DT);
}

describe("Overworld walking", () => {
  test("an input moves the player the way the shared walking rules do, and is acked", () => {
    const { overworld, me } = overworldIn();
    const expected = { ...EMPTY_LEVEL.spawn };
    stepWalker(EMPTY_LEVEL.layout, expected, { moveX: 1, moveZ: -1 }, FIXED_DT);

    overworld.input(me, 1, 1, -1);
    overworld.step(FIXED_DT);

    assert.deepEqual(overworld.playerPos(me), expected);
    assert.equal(overworld.playerData(me).ack, 1);
  });

  test("a straight step covers playerSpeed * FIXED_DT", () => {
    const { overworld, me } = overworldIn();
    overworld.input(me, 1, 1, 0);
    overworld.step(FIXED_DT);
    const moved = overworld.playerPos(me).x - EMPTY_LEVEL.spawn.x;
    assert.ok(Math.abs(moved - EMPTY_LEVEL.layout.playerSpeed * FIXED_DT) < 1e-9);
  });

  test("older and repeated seqs are ignored", () => {
    const { overworld, me } = overworldIn();
    overworld.input(me, 5, 1, 0);
    overworld.input(me, 5, 1, 0);
    overworld.input(me, 3, 1, 0);
    stepTicks(overworld, 5);
    assert.equal(overworld.playerData(me).ack, 5);
    const oneStep = EMPTY_LEVEL.layout.playerSpeed * FIXED_DT;
    assert.ok(Math.abs(overworld.playerPos(me).x - (EMPTY_LEVEL.spawn.x + oneStep)) < 1e-9);
  });

  test("one input is simulated per tick", () => {
    const { overworld, me } = overworldIn();
    sendInputs({ overworld, me }, 100);
    stepTicks(overworld, 10);
    assert.equal(overworld.playerData(me).ack, 10);
  });

  test("after a stall it catches up several inputs in a tick, but not a whole backlog", () => {
    const { overworld, me } = overworldIn();
    stepTicks(overworld, 60);
    sendInputs({ overworld, me }, 20);
    overworld.step(FIXED_DT);
    const ack = overworld.playerData(me).ack;
    assert.ok(ack > 1, `caught up ${ack}`);
    assert.ok(ack < 20, `caught up ${ack}`);
  });

  test("a flood of inputs can't move the player faster: most of it is dropped", () => {
    const { overworld, me } = overworldIn();
    sendInputs({ overworld, me }, 100);
    stepTicks(overworld, 200);
    const simulated = overworld.playerData(me).ack;
    assert.ok(simulated < 50, `simulated ${simulated} of 100`);
    assert.equal(overworld.playerData(me).queue.length, 0);
  });

  test("endFight drops queued inputs and makes the player safe for a while", () => {
    const { overworld, me } = overworldIn();
    sendInputs({ overworld, me }, 10);
    overworld.endFight(me, 1.5);
    const walk = overworld.playerData(me);
    assert.equal(walk.queue.length, 0);
    assert.equal(walk.credits, 0);
    assert.equal(walk.grassDist, 0);
    assert.equal(walk.safeTime, 1.5);
    const before = overworld.playerPos(me);
    overworld.step(FIXED_DT);
    assert.deepEqual(overworld.playerPos(me), before);
  });

  test("safeTime runs down with game time", () => {
    const { overworld, me } = overworldIn();
    overworld.endFight(me, 1);
    stepTicks(overworld, 30);
    assert.ok(Math.abs(overworld.playerData(me).safeTime - 0.5) < 1e-9);
    stepTicks(overworld, 60);
    assert.equal(overworld.playerData(me).safeTime, 0);
  });
});

describe("Overworld players", () => {
  test("a player joins at the level's spawn, beside the level's actors", () => {
    const { overworld, me } = overworldIn(TEST_LEVEL);
    assert.equal(overworld.level, TEST_LEVEL);
    assert.deepEqual(overworld.playerPos(me), TEST_LEVEL.spawn);
    assert.equal(actors(overworld.world).length, TEST_LEVEL.spawns.length);
  });

  test("players walk on their own inputs", () => {
    const { overworld, me } = overworldIn();
    const other = overworld.join(TEST_CHARACTER, () => {});
    overworld.input(other, 1, 0, 1);
    overworld.step(FIXED_DT);
    assert.deepEqual(overworld.playerPos(me), EMPTY_LEVEL.spawn);
    assert.ok(overworld.playerPos(other).z > EMPTY_LEVEL.spawn.z);
  });

  test("a player who leaves is removed", () => {
    const { overworld, me } = overworldIn();
    overworld.leave(me);
    assert.equal(overworld.world.isAlive(me), false);
  });

  test("place moves the player without simulating", () => {
    const { overworld, me } = overworldIn();
    overworld.place(me, { x: 3, z: -4 });
    assert.deepEqual(overworld.playerPos(me), { x: 3, z: -4 });
    assert.equal(overworld.playerData(me).ack, 0);
  });
});
