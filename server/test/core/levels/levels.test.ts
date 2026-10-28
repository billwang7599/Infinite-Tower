import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { inTallGrass } from "@infinite-tower/shared";
import type { EnemyId } from "../../../src/core/content/enemies.js";
import { touchSystem } from "../../../src/core/overworld/behaviors/touch.js";
import { OVERWORLD_PREFABS } from "../../../src/core/overworld/prefabs.js";
import { testOverworld } from "../overworld/helpers.js";
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
    for (const s of level.spawns) assert.ok(s.prefab in OVERWORLD_PREFABS);
    assert.ok(level.grass.enemies.reduce((sum, e) => sum + e.weight, 0) > 0);
    assert.ok(level.grass.stepDist > 0);
  });

  test("the Kobold Swordsman has a patch of its own: one spawns on the start level, away from the boar", () => {
    const level = getLevel(START_LEVEL);
    const kobold = level.spawns.find((s) => s.prefab === "kobold");
    const boar = level.spawns.find((s) => s.prefab === "boar");
    assert.ok(kobold && boar);
    assert.ok(Math.hypot(kobold.at.x - boar.at.x, kobold.at.z - boar.at.z) > 8);
    assert.equal(inTallGrass(level.layout, kobold.at.x, kobold.at.z), false);
  });

  test("the overworld kobold starts a Kobold Swordsman fight when it touches you", () => {
    const f = testOverworld({ playerAt: { x: 0.5, z: 0 } });
    const e = OVERWORLD_PREFABS.kobold(f.world, { x: 0, z: 0 });
    touchSystem(f.ctx)(f.world, 0.1);
    assert.deepEqual(f.encounters, [{ source: e, enemy: "kobold-swordsman" }]);
  });

  test("the Goblin Warlock has a corner of its own, away from the others, and starts its fight on touch", () => {
    const level = getLevel(START_LEVEL);
    const goblin = level.spawns.find((s) => s.prefab === "goblin");
    assert.ok(goblin);
    for (const other of level.spawns.filter((s) => s !== goblin)) {
      assert.ok(Math.hypot(goblin.at.x - other.at.x, goblin.at.z - other.at.z) > 8);
    }
    assert.equal(inTallGrass(level.layout, goblin.at.x, goblin.at.z), false);
    const f = testOverworld({ playerAt: { x: 0.5, z: 0 } });
    const e = OVERWORLD_PREFABS.goblin(f.world, { x: 0, z: 0 });
    touchSystem(f.ctx)(f.world, 0.1);
    assert.deepEqual(f.encounters, [{ source: e, enemy: "goblin-warlock" }]);
  });
});
