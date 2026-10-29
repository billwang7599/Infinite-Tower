import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { FIXED_DT, inTallGrass, type EnemyId, type Entity } from "@infinite-tower/shared";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import type { LevelDef } from "../../../src/core/world/level.js";
import { TEST_LEVEL } from "../../fixtures/level.js";

const LEVEL: LevelDef = { ...TEST_LEVEL, spawns: [] };
const PATCH = LEVEL.layout.grass[0]!;
/** Just left of the grass patch, level with its middle. */
const BESIDE_GRASS = { x: PATCH.x - 1, z: PATCH.z + PATCH.h / 2 };

interface Setup {
  overworld: Overworld;
  encounters: { source: Entity | null; enemy: EnemyId }[];
  queuedAtEncounter: number[];
}

/** Math.random is read once, when the Overworld is built, so it's mocked before that. */
function overworldWithRandom(t: TestContext, random: number): Setup {
  t.mock.method(Math, "random", () => random);
  const encounters: Setup["encounters"] = [];
  const queuedAtEncounter: number[] = [];
  const overworld = new Overworld((source, enemy) => {
    encounters.push({ source, enemy });
    queuedAtEncounter.push(overworld.playerData().queue.length);
  });
  overworld.enter(LEVEL);
  overworld.place(BESIDE_GRASS);
  return { overworld, encounters, queuedAtEncounter };
}

/** Seqs only have to rise, so one counter serves every overworld. */
let seq = 0;

/** Walk like a client: one input per tick, plus a few queued ahead. Stops when a fight starts, like a session. */
function walk({ overworld, encounters }: Setup, ticks: number, moveX: number, moveZ = 0): void {
  for (let i = 0; i < 5; i++) overworld.input(++seq, moveX, moveZ);
  for (let i = 0; i < ticks && encounters.length === 0; i++) {
    overworld.input(++seq, moveX, moveZ);
    overworld.step(FIXED_DT);
  }
}

/** Ticks to walk straight across the patch and out the other side. */
const CROSS_TICKS = Math.ceil((PATCH.w + 2) / (LEVEL.layout.playerSpeed * FIXED_DT));

describe("grass encounters", () => {
  test("walking into tall grass starts a fight with an enemy from the level's table", (t) => {
    const setup = overworldWithRandom(t, 0);
    const { overworld, encounters } = setup;
    walk(setup, CROSS_TICKS, 1);
    assert.equal(encounters.length, 1);
    assert.deepEqual(encounters[0], { source: null, enemy: LEVEL.grass.enemies[0]!.enemy });
    const at = overworld.playerPos();
    assert.ok(inTallGrass(LEVEL.layout, at.x, at.z), "the fight starts where the player is in the grass");
  });

  test("the encounter throws away the inputs still queued", (t) => {
    const setup = overworldWithRandom(t, 0);
    const { overworld, queuedAtEncounter } = setup;
    walk(setup, CROSS_TICKS, 1);
    assert.deepEqual(queuedAtEncounter, [0]);
    assert.equal(overworld.playerData().queue.length, 0);
  });

  test("the first roll comes only after walking grass.stepDist tiles in grass", (t) => {
    const setup = overworldWithRandom(t, 0);
    const { overworld, encounters } = setup;
    const ticksToEnter = Math.ceil(1 / (LEVEL.layout.playerSpeed * FIXED_DT));
    walk(setup, ticksToEnter, 1);
    assert.equal(encounters.length, 0);
    assert.ok(overworld.playerData().grassDist < LEVEL.grass.stepDist);
  });

  test("walking outside the grass never starts one", (t) => {
    const setup = overworldWithRandom(t, 0);
    const { overworld, encounters } = setup;
    walk(setup, 120, -1);
    walk(setup, 60, 0, 1);
    assert.equal(encounters.length, 0);
    assert.equal(overworld.playerData().grassDist, 0);
  });

  test("no encounters while the player is safe after a fight", (t) => {
    const setup = overworldWithRandom(t, 0);
    const { overworld, encounters } = setup;
    const crossTime = CROSS_TICKS * FIXED_DT;
    overworld.resetWalk(crossTime + 1);
    walk(setup, CROSS_TICKS, 1);
    assert.equal(encounters.length, 0);
    assert.ok(overworld.playerPos().x > PATCH.x + PATCH.w, "walked all the way through");
  });

  test("a roll above the chance doesn't start one", (t) => {
    const setup = overworldWithRandom(t, 0.999);
    const { overworld, encounters } = setup;
    assert.ok(LEVEL.grass.chance < 0.999);
    walk(setup, CROSS_TICKS, 1);
    assert.equal(encounters.length, 0);
    assert.ok(overworld.playerPos().x > PATCH.x + PATCH.w);
  });
});
