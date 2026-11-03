import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ARENA_LOOK_IDS, CHUNK_TILES, ENEMY_IDS, inTallGrass, isSolid, regionAt, tileAt, type EnemyId,
} from "@infinite-tower/shared";
import { ARENAS, getArena, getRegion, START_REGION, WORLD } from "../../../src/core/world/index.js";
import { rollEnemy, type EncounterTable, type RegionDef } from "../../../src/core/world/region.js";
import { composeWorld, VOID_TILE, WORLD_MARGIN_TILES } from "../../../src/core/world/world.js";

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

describe("getRegion", () => {
  test("finds the start region by its id", () => {
    assert.equal(getRegion(START_REGION).id, START_REGION);
  });

  test("throws for an unknown id", () => {
    assert.throws(() => getRegion("no-such-region"), /no-such-region/);
  });

  test("the start region's arena exists", () => {
    assert.equal(getArena(getRegion(START_REGION).arenaId).id, getRegion(START_REGION).arenaId);
  });

  test("every region is playable: spawn inside, out of the grass, known enemies, a weighted table if any", () => {
    for (const level of WORLD.regions) {
      assert.equal(isSolid(WORLD.layout, level.spawn.x, level.spawn.z), false);
      assert.equal(inTallGrass(WORLD.layout, level.spawn.x, level.spawn.z), false);
      for (const s of level.spawns) assert.ok(ENEMY_IDS.includes(s.enemy));
      if (!level.grass) continue;
      assert.ok(level.grass.enemies.reduce((sum, e) => sum + e.weight, 0) > 0);
      assert.ok(level.grass.stepDist > 0);
    }
  });

  test("the Kobold Swordsman has a patch of its own: one spawns on the Grass Field, away from the boar", () => {
    const level = getRegion("grass-field");
    const kobold = level.spawns.find((s) => s.enemy === "kobold-swordsman");
    const boar = level.spawns.find((s) => s.enemy === "wild-boar");
    assert.ok(kobold && boar);
    assert.ok(Math.hypot(kobold.at.x - boar.at.x, kobold.at.z - boar.at.z) > 8);
    assert.equal(inTallGrass(WORLD.layout, kobold.at.x, kobold.at.z), false);
  });

  test("the Kobold Greatsword spawns near the Kobold Swordsman, out of the grass", () => {
    const level = getRegion("grass-field");
    const big = level.spawns.find((s) => s.enemy === "kobold-greatsword");
    const kobold = level.spawns.find((s) => s.enemy === "kobold-swordsman");
    assert.ok(big && kobold);
    assert.ok(Math.hypot(big.at.x - kobold.at.x, big.at.z - kobold.at.z) < 12);
    assert.equal(inTallGrass(WORLD.layout, big.at.x, big.at.z), false);
  });

  test("the Goblin Warlock has a corner of its own, away from the others", () => {
    const level = getRegion("grass-field");
    const goblin = level.spawns.find((s) => s.enemy === "goblin-warlock");
    assert.ok(goblin);
    for (const other of level.spawns.filter((s) => s !== goblin)) {
      assert.ok(Math.hypot(goblin.at.x - other.at.x, goblin.at.z - other.at.z) > 8);
    }
    assert.equal(inTallGrass(WORLD.layout, goblin.at.x, goblin.at.z), false);
  });
});

describe("getArena", () => {
  test("throws for an unknown id", () => {
    assert.throws(() => getArena("no-such-arena"), /no-such-arena/);
  });

  test("every arena a spawn names exists", () => {
    for (const region of WORLD.regions) {
      for (const s of region.spawns) if (s.arenaId !== undefined) getArena(s.arenaId);
    }
  });

  test("every arena has a known look and the same round wall as the start region's", () => {
    const radius = getArena(getRegion(START_REGION).arenaId).radius;
    for (const arena of Object.values(ARENAS)) {
      assert.ok(ARENA_LOOK_IDS.includes(arena.look), arena.id);
      assert.equal(arena.radius, radius, arena.id);
    }
  });

  test("the boar fights in the region's arena; both Kobolds share one of their own, and the Warlock has another", () => {
    const level = getRegion("grass-field");
    const arenaOf = (enemy: string) => level.spawns.find((s) => s.enemy === enemy)?.arenaId ?? level.arenaId;
    assert.equal(arenaOf("wild-boar"), level.arenaId);
    assert.equal(arenaOf("kobold-swordsman"), arenaOf("kobold-greatsword"));
    const looks = new Set(["wild-boar", "kobold-swordsman", "goblin-warlock"].map((e) => getArena(arenaOf(e)).look));
    assert.equal(looks.size, 3);
  });
});

const square = (id: string, origin: { x: number; z: number }, open: { west?: boolean; east?: boolean } = {}): RegionDef => ({
  id, name: id, theme: "grass-field", origin, fill: "T", campfires: [], spawn: { x: 0, z: 0 }, arenaId: "grass-field",
  duelArenaId: "kobold-ruins", spawns: [{ enemy: "wild-boar", at: { x: 1.5, z: 0.5 }, respawnTime: 1 }],
  tiles: Array.from({ length: 4 }, (_, r) => r === 0 || r === 3 ? "TTTT"
    : `${open.west ? "." : "T"}..${open.east ? "." : "T"}`),
});

describe("composeWorld", () => {
  const WEST = square("west", { x: -2, z: 0 }, { east: true }), EAST = square("east", { x: 2, z: 0 }, { west: true });
  const world = composeWorld([WEST, EAST]);

  test("lays each region's tiles where its origin puts them, side by side, so their edges meet", () => {
    assert.equal(tileAt(world.layout, -3.5, 1.5), "tree");
    assert.equal(tileAt(world.layout, -0.5, 0.5), "grass");
    assert.equal(tileAt(world.layout, 0.5, 0.5), "grass");
    assert.deepEqual(world.regions.map((r) => r.area), [{ x: -4, z: -2, w: 4, h: 4 }, { x: 0, z: -2, w: 4, h: 4 }]);
  });

  test("its bounds lie on whole chunks, at least the margin past every region", () => {
    const { bounds } = world.layout;
    for (const v of [bounds.x, bounds.z, bounds.w, bounds.h]) assert.ok(v % CHUNK_TILES === 0, `${v}`);
    assert.ok(bounds.x <= -4 - WORLD_MARGIN_TILES && bounds.x + bounds.w >= 4 + WORLD_MARGIN_TILES);
    assert.equal(world.layout.tiles.length, bounds.h);
    for (const row of world.layout.tiles) assert.equal(row.length, bounds.w);
  });

  test("fills the land round them with the nearest region's fill, and nothing past the margin", () => {
    assert.equal(tileAt(world.layout, 5.5, 0.5), "tree");
    assert.equal(regionAt(world.layout, 5.5, 0.5).id, "east");
    assert.equal(regionAt(world.layout, -5.5, 0.5).id, "west");
    const far = world.layout.bounds;
    assert.equal(world.layout.tiles[0]![0], VOID_TILE);
    assert.equal(tileAt(world.layout, far.x + 0.5, far.z + 0.5), null);
    assert.equal(isSolid(world.layout, far.x + 0.5, far.z + 0.5), true);
  });

  test("moves each region's spawns, campfires and start into the world", () => {
    const [west, east] = world.regions;
    assert.deepEqual(west!.spawn, { x: -2, z: 0 });
    assert.deepEqual(east!.spawns[0]!.at, { x: 3.5, z: 0.5 });
    assert.deepEqual(east!.spawns[0]!.away, { x: 0.5, z: 0.5 }, "mirrored across its own region");
    assert.equal(world.spawns.length, 2);
  });

  test("refuses regions that overlap", () => {
    assert.throws(() => composeWorld([WEST, square("east", { x: 0, z: 0 })]), /overlaps/);
  });

  test("paints the patches over the tiles", () => {
    const patched = composeWorld([WEST], [{ rect: { x: -4, z: 0, w: 1, h: 1 }, char: ":" }]);
    assert.equal(tileAt(patched.layout, -3.5, 0.5), "path");
  });
});
