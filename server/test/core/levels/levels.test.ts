import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inTallGrass } from "@infinite-tower/shared";
import type { EnemyId } from "../../../src/core/content/enemies.js";
import { FIELD_PREFABS } from "../../../src/core/field/prefabs/index.js";
import { getLevel, START_LEVEL } from "../../../src/core/levels/index.js";
import { rollEnemy, type EncounterTable } from "../../../src/core/levels/level.js";

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

  test("the start level is playable: spawn inside, out of the grass, known prefabs, a weighted table", () => {
    const level = getLevel(START_LEVEL);
    const { halfWidth, halfDepth, border } = level.layout;
    assert.ok(Math.abs(level.spawn.x) <= halfWidth - border && Math.abs(level.spawn.z) <= halfDepth - border);
    assert.equal(inTallGrass(level.layout, level.spawn.x, level.spawn.z), false);
    for (const s of level.spawns) assert.ok(s.prefab in FIELD_PREFABS);
    assert.ok(level.grass.enemies.reduce((sum, e) => sum + e.weight, 0) > 0);
    assert.ok(level.grass.stepDist > 0);
  });
});
