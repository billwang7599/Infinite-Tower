import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  distXZ, inRect, inTallGrass, INTERACT_RANGE_M, isSolid, mapHalfSize, nearCampfire, REST_RANGE_TILES, tileAt,
  WALKER_RADIUS, NPC_IDS, type LevelMap, type Vec2,
} from "@infinite-tower/shared";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getArena, getLevel, LEVELS, loginLevel, START_LEVEL } from "../../../src/core/world/index.js";
import type { ExitDef, LevelDef } from "../../../src/core/world/level.js";

const centersOf = (layout: LevelMap) => {
  const { halfWidth, halfDepth } = mapHalfSize(layout);
  return layout.tiles.flatMap((row, r) =>
    [...row].map((_, c) => ({ c, r, x: c - halfWidth + 0.5, z: halfDepth - r - 0.5 })));
};

function reachableFrom(layout: LevelMap, start: Vec2): (at: Vec2) => boolean {
  const { halfWidth, halfDepth } = mapHalfSize(layout);
  const cell = (at: Vec2) => ({ c: Math.floor(at.x + halfWidth), r: Math.floor(halfDepth - at.z) });
  const key = ({ c, r }: { c: number; r: number }) => `${c},${r}`;
  const seen = new Set([key(cell(start))]), todo = [cell(start)];
  while (todo.length > 0) {
    const { c, r } = todo.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { c: c + dc, r: r + dr };
      if (seen.has(key(n)) || isSolid(layout, n.c - halfWidth + 0.5, halfDepth - n.r - 0.5)) continue;
      seen.add(key(n));
      todo.push(n);
    }
  }
  return (at) => seen.has(key(cell(at)));
}

const fitsAt = (layout: LevelMap, p: Vec2) => [-1, 1].every((sx) => [-1, 1].every((sz) =>
  !isSolid(layout, p.x + sx * WALKER_RADIUS, p.z + sz * WALKER_RADIUS)));

const inExit = (exit: ExitDef, at: Vec2) => inRect(exit.area, at.x, at.z);

const areaCenter = ({ area }: ExitDef): Vec2 => ({ x: area.x + area.w / 2, z: area.z + area.h / 2 });

const ENTRANCE_REACH_TILES = 4;

for (const level of Object.values(LEVELS) as LevelDef[]) {
  const { layout } = level, centers = centersOf(layout), reachable = reachableFrom(layout, level.spawn);
  const rows = layout.tiles.length, cols = layout.tiles[0]!.length;

  describe(`${layout.name}'s map`, () => {
    test("is a rectangle of known tiles", () => {
      for (const row of layout.tiles) assert.equal(row.length, cols);
      for (const t of centers) assert.notEqual(tileAt(layout, t.x, t.z), null, `row ${t.r}, column ${t.c}`);
    });

    test("its edge is solid all round but for its exits", () => {
      for (const t of centers) {
        const edge = t.r === 0 || t.c === 0 || t.r === rows - 1 || t.c === cols - 1;
        if (edge && !isSolid(layout, t.x, t.z)) {
          assert.ok(level.exits.some((e) => inExit(e, t)), `row ${t.r}, column ${t.c} is open but no exit`);
        }
      }
    });

    test("where it wakes you is a summoning pad: you wake standing on it", () => {
      const wake = getLevel(loginLevel(layout.id));
      assert.equal(loginLevel(wake.layout.id), wake.layout.id);
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
        const at = { x: wake.spawn.x + sx * WALKER_RADIUS, z: wake.spawn.z + sz * WALKER_RADIUS };
        assert.equal(tileAt(wake.layout, at.x, at.z), "pad");
      }
    });

    test("has tall grass if its grass starts fights, and the start isn't in it", () => {
      assert.equal(centers.some((t) => inTallGrass(layout, t.x, t.z)), level.grass !== undefined);
      assert.equal(inTallGrass(layout, level.spawn.x, level.spawn.z), false);
    });

    // The spawner moves a spawn to the other side (x mirrored) when the player stands near it.
    const places: [string, Vec2][] = [
      ["the start", level.spawn],
      ...layout.campfires.map((c, i): [string, Vec2] => [`campfire ${i}`, c]),
      ...NPC_IDS.flatMap((npc) => NPCS[npc].stops.filter((s) => s.level === layout.id).flatMap((s): [string, Vec2][] =>
        [[npc, s.at], ...s.trace ? [[`${npc}'s trace`, s.trace.at] as [string, Vec2]] : []])),
      ...level.spawns.flatMap((s): [string, Vec2][] => [
        [s.enemy, s.at], [`${s.enemy} (mirrored)`, { x: -s.at.x, z: s.at.z }],
      ]),
    ];

    test("the start, the campfires, the NPCs, their traces and every spawn stand clear of solid tiles", () => {
      for (const [name, at] of places) assert.ok(fitsAt(layout, at), name);
    });

    test("all of them can be walked to from the start", () => {
      for (const [name, at] of places) assert.ok(reachable(at), name);
    });

    test("has a campfire only out in the wild, where there are enemies", () => {
      assert.equal(layout.campfires.length > 0, level.spawns.length > 0 || level.grass !== undefined);
    });
  });

  describe(`${layout.name}'s exits`, () => {
    test("each lies on the map's edge, open and walkable from the start", () => {
      for (const exit of level.exits) {
        const tiles = centers.filter((t) => inExit(exit, t));
        assert.ok(tiles.length > 0, `exit to ${exit.to}`);
        for (const t of tiles) {
          assert.ok(t.c === 0 || t.r === 0 || t.c === cols - 1 || t.r === rows - 1, `exit to ${exit.to}: ${t.c}, ${t.r}`);
          assert.ok(!isSolid(layout, t.x, t.z) && reachable(t), `exit to ${exit.to}: ${t.c}, ${t.r}`);
        }
      }
    });

    test("each leads to a level, arriving clear of solid tiles and of its exits, where its start can walk", () => {
      for (const exit of level.exits) {
        const to = getLevel(exit.to);
        assert.ok(fitsAt(to.layout, exit.at), `arriving on ${exit.to}`);
        assert.ok(reachableFrom(to.layout, to.spawn)(exit.at), `arriving on ${exit.to}`);
        assert.ok(!to.exits.some((e) => inExit(e, exit.at)), `arriving on ${exit.to} inside an exit`);
      }
    });

    test("each has a way back beside where it arrives, which arrives beside it", () => {
      for (const exit of level.exits) {
        const back = getLevel(exit.to).exits
          .find((e) => e.to === layout.id && distXZ(areaCenter(e), exit.at) <= ENTRANCE_REACH_TILES);
        assert.ok(back, `no way back from ${exit.to}`);
        assert.ok(distXZ(back.at, areaCenter(exit)) <= ENTRANCE_REACH_TILES, `the way back from ${exit.to}`);
      }
    });
  });
}

const HOLLOW = getLevel("waking-hollow");

test("for a new player a native stands by the Waking Hollow's campfire, in talking reach of someone resting", () => {
  const { layout } = HOLLOW;
  const byFire = NPC_IDS.map((npc) => stopFor(newStory(), NPCS[npc])).filter((stop) => stop?.level === layout.id
    && layout.campfires.some((fire) => distXZ(stop.at, fire) <= REST_RANGE_TILES + INTERACT_RANGE_M));
  assert.equal(byFire.length, 1);
});

test("the Waking Hollow is gentle: only boars, and its tall grass starts fewer fights than any other level's", () => {
  const enemies = [...HOLLOW.spawns.map((s) => s.enemy), ...HOLLOW.grass!.enemies.map((e) => e.enemy)];
  assert.deepEqual([...new Set(enemies)], ["wild-boar"]);
  for (const level of Object.values(LEVELS).filter((l) => l !== HOLLOW && l.grass)) {
    assert.ok(HOLLOW.grass!.chance < level.grass!.chance, level.layout.id);
  }
});

test("every level can be reached from the start level through exits", () => {
  const ids = Object.keys(LEVELS), reached = new Set([START_LEVEL]), todo = [START_LEVEL];
  while (todo.length > 0) {
    for (const exit of getLevel(todo.pop()!).exits) {
      if (!reached.has(exit.to)) { reached.add(exit.to); todo.push(exit.to); }
    }
  }
  assert.deepEqual([...reached].sort(), [...ids].sort());
});

describe("the Old Quarry", () => {
  const QUARRY = getLevel("old-quarry"), FIELD = getLevel("grass-field");
  const fromField = FIELD.exits.find((e) => e.to === "old-quarry");

  test("is reached through a gap in the Grass Field's north edge, and leads back out through its own", () => {
    assert.ok(fromField);
    assert.equal(fromField.area.z + fromField.area.h, mapHalfSize(FIELD.layout).halfDepth);
    const back = QUARRY.exits.find((e) => e.to === "grass-field");
    assert.ok(back);
    assert.equal(back.area.z, -mapHalfSize(QUARRY.layout).halfDepth);
  });

  test("is held by Kobolds and Goblin Warlocks only, in its spawns and its scrub alike", () => {
    const enemies = new Set([...QUARRY.spawns.map((s) => s.enemy), ...QUARRY.grass!.enemies.map((e) => e.enemy)]);
    assert.deepEqual([...enemies].sort(), ["goblin-warlock", "kobold-greatsword", "kobold-swordsman"]);
  });

  test("is harder than the Grass Field: more enemies standing about, and its scrub starts fights as often", () => {
    assert.ok(QUARRY.spawns.length > FIELD.spawns.length);
    assert.ok(QUARRY.grass!.chance >= FIELD.grass!.chance);
  });

  test("has one campfire, by the way in, where you can rest", () => {
    assert.equal(QUARRY.layout.campfires.length, 1);
    const [fire] = QUARRY.layout.campfires;
    assert.ok(distXZ(fire!, fromField!.at) <= 8);
    assert.ok(nearCampfire(QUARRY.layout, { x: fire!.x + REST_RANGE_TILES - 0.1, z: fire!.z }));
  });

  test("has a still pool at the bottom of its pit, its water touching no edge", () => {
    const { halfWidth, halfDepth } = mapHalfSize(QUARRY.layout);
    const water = centersOf(QUARRY.layout).filter((t) => tileAt(QUARRY.layout, t.x, t.z) === "water");
    assert.ok(water.length > 0);
    for (const t of water) assert.ok(Math.abs(t.x) < halfWidth - 4 && Math.abs(t.z) < halfDepth - 4);
  });

  test("fights in a quarry arena of its own, duels and every spawn too, which no other level fights in", () => {
    const arenas = [QUARRY.arenaId, QUARRY.duelArenaId, ...QUARRY.spawns.map((s) => s.arenaId ?? QUARRY.arenaId)];
    for (const id of arenas) assert.equal(getArena(id).look, "quarry");
    for (const level of Object.values(LEVELS).filter((l) => l !== QUARRY)) {
      const looks = [level.arenaId, level.duelArenaId, ...level.spawns.map((s) => s.arenaId ?? level.arenaId)]
        .map((id) => getArena(id).look);
      assert.ok(!looks.includes("quarry"), level.layout.id);
    }
  });
});
