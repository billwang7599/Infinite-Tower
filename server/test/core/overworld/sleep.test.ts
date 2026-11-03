import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { FIXED_DT, type Entity } from "@infinite-tower/shared";
import { OverworldActor, OverworldPos } from "../../../src/core/overworld/components.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import { AWAKE_TILES, Asleep } from "../../../src/core/overworld/sleep.js";
import { TEST_CHARACTER, testWorld } from "../../fixtures/world.js";

const BOAR_AT = { x: 80, z: 0 };
/** Open ground far wider than the waking reach, one boar wandering at its east end. */
const WIDE = testWorld({
  tiles: Array.from({ length: 40 }, () => ".".repeat(200)), spawn: { x: -80, z: 0 },
  spawns: [{ enemy: "wild-boar", at: BOAR_AT, respawnTime: 3 }],
});
const TEN_SECONDS = Math.round(10 / FIXED_DT);

function setup(t: TestContext) {
  t.mock.method(Math, "random", () => 0.5);
  const overworld = new Overworld(WIDE);
  const me = overworld.join(TEST_CHARACTER, () => {});
  const [boar] = [...overworld.world.query(OverworldActor, OverworldPos)].map(([e]) => e);
  const step = (ticks: number) => { for (let i = 0; i < ticks; i++) overworld.step(FIXED_DT); };
  const boarAt = () => ({ ...overworld.world.require(boar!, OverworldPos) });
  return { overworld, me, boar: boar as Entity, step, boarAt };
}

describe("a part of the world with nobody near sleeps", () => {
  test("a monster further than AWAKE_TILES from every player stays put", (t) => {
    const { overworld, boar, step, boarAt } = setup(t);
    assert.ok(Math.abs(BOAR_AT.x - -80) > AWAKE_TILES);
    step(TEN_SECONDS);
    assert.deepEqual(boarAt(), BOAR_AT);
    assert.ok(overworld.world.has(boar, Asleep));
  });

  test("it wakes when a player comes near, and goes about its business", (t) => {
    const { overworld, me, boar, step, boarAt } = setup(t);
    step(10);
    overworld.place(me, { x: BOAR_AT.x - AWAKE_TILES + 5, z: 0 });
    step(TEN_SECONDS);
    assert.equal(overworld.world.has(boar, Asleep), false);
    assert.notDeepEqual(boarAt(), BOAR_AT);
  });

  test("a player in a fight doesn't keep it awake", (t) => {
    const { overworld, me, boar, step } = setup(t);
    overworld.place(me, { x: BOAR_AT.x - 10, z: 0 });
    step(10);
    assert.equal(overworld.world.has(boar, Asleep), false);
    overworld.enterFight(me);
    step(30);
    assert.ok(overworld.world.has(boar, Asleep));
  });
});
