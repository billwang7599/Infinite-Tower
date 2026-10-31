import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ARENA_LOOK_IDS, ENEMY_IDS, inTallGrass, isSolid, type EnemyId } from "@infinite-tower/shared";
import { ARENAS, getArena, getLevel, LEVELS, START_LEVEL } from "../../../src/core/world/index.js";
import { rollEnemy, type EncounterTable } from "../../../src/core/world/level.js";

// Only one enemy exists so far, so the table uses made-up ids to tell the picks apart.
const [A, B, C] = ["a", "b", "c"] as unknown as [EnemyId, EnemyId, EnemyId];
const TABLE: EncounterTable = {
  stepDist: 1, chance: 1,
  enemies: [{ enemy: A, weight: 1 }, { enemy: B, weight: 2 }, { enemy: C, weight: 1 }],
};

describe("rollEnemy", () => {
  test("a roll of 0 picks the first enemy", () => {
    assert.equal(rollEnemy(TABLE, () => 0), A);
  });

  test("a roll just under 1 picks the last enemy", () => {
    assert.equal(rollEnemy(TABLE, () => 0.9999999), C);
  });

  test("each enemy gets a share of the rolls matching its weight", () => {
    // Weights 1:2:1 of 4: [0, 0.25) → A, [0.25, 0.75) → B, [0.75, 1) → C.
    assert.equal(rollEnemy(TABLE, () => 0.24), A);
    assert.equal(rollEnemy(TABLE, () => 0.25), B);
    assert.equal(rollEnemy(TABLE, () => 0.5), B);
    assert.equal(rollEnemy(TABLE, () => 0.74), B);
    assert.equal(rollEnemy(TABLE, () => 0.75), C);
  });

  test("an enemy with weight 0 is never picked", () => {
    const table: EncounterTable = { ...TABLE, enemies: [{ enemy: A, weight: 0 }, { enemy: B, weight: 1 }] };
    assert.equal(rollEnemy(table, () => 0), B);
  });

  test("uses the rng once per roll", () => {
    let calls = 0;
    rollEnemy(TABLE, () => { calls++; return 0.5; });
    assert.equal(calls, 1);
  });
});

describe("getLevel", () => {
  test("finds the start level by its id", () => {
    assert.equal(getLevel(START_LEVEL).layout.id, START_LEVEL);
  });

  test("throws for an unknown id", () => {
    assert.throws(() => getLevel("no-such-level"), /no-such-level/);
  });

  test("the start level's arena exists", () => {
    assert.equal(getArena(getLevel(START_LEVEL).arenaId).id, getLevel(START_LEVEL).arenaId);
  });

  test("the start level is playable: spawn inside, out of the grass, known enemies, a weighted table", () => {
    const level = getLevel(START_LEVEL);
    assert.equal(isSolid(level.layout, level.spawn.x, level.spawn.z), false);
    assert.equal(inTallGrass(level.layout, level.spawn.x, level.spawn.z), false);
    for (const s of level.spawns) assert.ok(ENEMY_IDS.includes(s.enemy));
    assert.ok(level.grass.enemies.reduce((sum, e) => sum + e.weight, 0) > 0);
    assert.ok(level.grass.stepDist > 0);
  });

  test("the Kobold Swordsman has a patch of its own: one spawns on the Grass Field, away from the boar", () => {
    const level = getLevel("grass-field");
    const kobold = level.spawns.find((s) => s.enemy === "kobold-swordsman");
    const boar = level.spawns.find((s) => s.enemy === "wild-boar");
    assert.ok(kobold && boar);
    assert.ok(Math.hypot(kobold.at.x - boar.at.x, kobold.at.z - boar.at.z) > 8);
    assert.equal(inTallGrass(level.layout, kobold.at.x, kobold.at.z), false);
  });

  test("the Kobold Greatsword spawns near the Kobold Swordsman, out of the grass", () => {
    const level = getLevel("grass-field");
    const big = level.spawns.find((s) => s.enemy === "kobold-greatsword");
    const kobold = level.spawns.find((s) => s.enemy === "kobold-swordsman");
    assert.ok(big && kobold);
    assert.ok(Math.hypot(big.at.x - kobold.at.x, big.at.z - kobold.at.z) < 12);
    assert.equal(inTallGrass(level.layout, big.at.x, big.at.z), false);
  });

  test("the Goblin Warlock has a corner of its own, away from the others", () => {
    const level = getLevel("grass-field");
    const goblin = level.spawns.find((s) => s.enemy === "goblin-warlock");
    assert.ok(goblin);
    for (const other of level.spawns.filter((s) => s !== goblin)) {
      assert.ok(Math.hypot(goblin.at.x - other.at.x, goblin.at.z - other.at.z) > 8);
    }
    assert.equal(inTallGrass(level.layout, goblin.at.x, goblin.at.z), false);
  });
});

describe("getArena", () => {
  test("throws for an unknown id", () => {
    assert.throws(() => getArena("no-such-arena"), /no-such-arena/);
  });

  test("every arena a spawn names exists", () => {
    for (const level of Object.values(LEVELS)) {
      for (const s of level.spawns) if (s.arenaId !== undefined) getArena(s.arenaId);
    }
  });

  test("every arena has a known look and the same round wall as the start level's", () => {
    const radius = getArena(getLevel(START_LEVEL).arenaId).radius;
    for (const arena of Object.values(ARENAS)) {
      assert.ok(ARENA_LOOK_IDS.includes(arena.look), arena.id);
      assert.equal(arena.radius, radius, arena.id);
    }
  });

  test("the boar fights in the level's arena; both Kobolds share one of their own, and the Warlock has another", () => {
    const level = getLevel("grass-field");
    const arenaOf = (enemy: string) => level.spawns.find((s) => s.enemy === enemy)?.arenaId ?? level.arenaId;
    assert.equal(arenaOf("wild-boar"), level.arenaId);
    assert.equal(arenaOf("kobold-swordsman"), arenaOf("kobold-greatsword"));
    const looks = new Set(["wild-boar", "kobold-swordsman", "goblin-warlock"].map((e) => getArena(arenaOf(e)).look));
    assert.equal(looks.size, 3);
  });
});
