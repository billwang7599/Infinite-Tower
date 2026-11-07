import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  distXZ, inTallGrass, INTERACT_RANGE_M, isSolid, nearCampfire, NPC_IDS, regionAt, REST_RANGE_TILES, tileAt,
  WALKER_RADIUS, type Vec2,
} from "@infinite-tower/shared";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getArena, getRegion, START_REGION, wakeRegion, WORLD } from "../../../src/core/world/index.js";

const { layout } = WORLD;

function reachableFrom(start: Vec2): (at: Vec2) => boolean {
  const key = (x: number, z: number) => `${Math.floor(x)},${Math.floor(z)}`;
  const seen = new Set([key(start.x, start.z)]), todo = [{ x: Math.floor(start.x), z: Math.floor(start.z) }];
  while (todo.length > 0) {
    const { x, z } = todo.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: x + dx, z: z + dz };
      if (seen.has(key(n.x, n.z)) || isSolid(layout, n.x + 0.5, n.z + 0.5)) continue;
      seen.add(key(n.x, n.z));
      todo.push(n);
    }
  }
  return (at) => seen.has(key(at.x, at.z));
}

const fitsAt = (p: Vec2) => [-1, 1].every((sx) => [-1, 1].every((sz) =>
  !isSolid(layout, p.x + sx * WALKER_RADIUS, p.z + sz * WALKER_RADIUS)));

const fromStart = reachableFrom(getRegion(START_REGION).spawn);

for (const region of WORLD.regions) {
  describe(region.name, () => {
    test("bound to it, you wake on a summoning pad, standing on it", () => {
      const wake = getRegion(wakeRegion(region.id));
      assert.equal(wakeRegion(wake.id), wake.id);
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
        assert.equal(tileAt(layout, wake.spawn.x + sx * WALKER_RADIUS, wake.spawn.z + sz * WALKER_RADIUS), "pad");
      }
    });

    test("its spawn is in it, out of the tall grass", () => {
      assert.equal(regionAt(layout, region.spawn.x, region.spawn.z).id, region.id);
      assert.equal(inTallGrass(layout, region.spawn.x, region.spawn.z), false);
    });

    const places: [string, Vec2][] = [
      ["the start", region.spawn],
      ...region.campfires.map((c, i): [string, Vec2] => [`campfire ${i}`, c]),
      ...NPC_IDS.flatMap((npc) => NPCS[npc].stops.filter((s) => s.region === region.id).flatMap((s): [string, Vec2][] =>
        [[npc, s.at], ...s.trace ? [[`${npc}'s trace`, s.trace.at] as [string, Vec2]] : []])),
      ...region.spawns.flatMap((s): [string, Vec2][] => [[s.enemy, s.at], [`${s.enemy} (away)`, s.away!]]),
    ];

    test("the start, the campfires, the NPCs, their traces and every spawn stand in it, clear of solid tiles", () => {
      for (const [name, at] of places) {
        assert.ok(fitsAt(at), name);
        assert.equal(regionAt(layout, at.x, at.z).id, region.id, name);
      }
    });

    test("all of them can be walked to from Highmere's platform", () => {
      for (const [name, at] of places) assert.ok(fromStart(at), name);
    });

    test("has a campfire only out in the wild, where there are enemies: Highmere has none", () => {
      const wild = region.theme !== "kingdom";
      assert.equal(region.campfires.length > 0, wild && (region.spawns.length > 0 || region.grass !== undefined));
    });
  });
}

const HOLLOW = getRegion("waking-hollow");

test("for a new player a native stands by the Waking Hollow's campfire, in talking reach of someone resting", () => {
  const byFire = NPC_IDS.map((npc) => stopFor(newStory(), NPCS[npc])).filter((stop) => stop?.region === HOLLOW.id
    && HOLLOW.campfires.some((fire) => distXZ(stop.at, fire) <= REST_RANGE_TILES + INTERACT_RANGE_M));
  assert.equal(byFire.length, 1);
});

test("the Waking Hollow is gentle: only boars, and its tall grass starts fewer fights than any other region's", () => {
  const enemies = [...HOLLOW.spawns.map((s) => s.enemy), ...HOLLOW.grass!.enemies.map((e) => e.enemy)];
  assert.deepEqual([...new Set(enemies)], ["wild-boar"]);
  for (const region of WORLD.regions.filter((r) => r !== HOLLOW && r.grass)) {
    assert.ok(HOLLOW.grass!.chance < region.grass!.chance, region.id);
  }
});

describe("the Old Quarry", () => {
  const QUARRY = getRegion("old-quarry"), FIELD = getRegion("grass-field");

  test("lies north of the Grass Field, through a gap in its north edge", () => {
    assert.equal(QUARRY.area.z, FIELD.area.z + FIELD.area.h);
    const gap = Array.from({ length: FIELD.area.w }, (_, i) => FIELD.area.x + i + 0.5)
      .filter((x) => !isSolid(layout, x, QUARRY.area.z + 0.5) && !isSolid(layout, x, QUARRY.area.z - 0.5));
    assert.ok(gap.length > 0);
  });

  test("is held by Kobolds and Goblin Warlocks only, in its spawns and its scrub alike", () => {
    const enemies = new Set([...QUARRY.spawns.map((s) => s.enemy), ...QUARRY.grass!.enemies.map((e) => e.enemy)]);
    assert.deepEqual([...enemies].sort(),
      ["goblin-warlock", "kobold-greatsword", "kobold-shieldbearer", "kobold-swordsman"]);
  });

  test("is harder than the Grass Field: more enemies standing about, and its scrub starts fights as often", () => {
    assert.ok(QUARRY.spawns.length > FIELD.spawns.length);
    assert.ok(QUARRY.grass!.chance >= FIELD.grass!.chance);
  });

  test("has one campfire, by the way in, where you can rest", () => {
    assert.equal(QUARRY.campfires.length, 1);
    const [fire] = QUARRY.campfires;
    assert.ok(fire!.z - QUARRY.area.z <= 8);
    assert.ok(nearCampfire(layout, { x: fire!.x + REST_RANGE_TILES - 0.1, z: fire!.z }));
  });

  test("has a still pool at the bottom of its pit, well inside it", () => {
    const { area } = QUARRY, water: Vec2[] = [];
    for (let x = area.x; x < area.x + area.w; x++) {
      for (let z = area.z; z < area.z + area.h; z++) {
        if (tileAt(layout, x + 0.5, z + 0.5) === "water") water.push({ x, z });
      }
    }
    assert.ok(water.length > 0);
    for (const t of water) {
      assert.ok(t.x > area.x + 4 && t.x < area.x + area.w - 4 && t.z > area.z + 4 && t.z < area.z + area.h - 4);
    }
  });

  test("fights in a quarry arena of its own, duels and every spawn too, which no other region fights in", () => {
    const arenas = [QUARRY.arenaId, QUARRY.duelArenaId, ...QUARRY.spawns.map((s) => s.arenaId ?? QUARRY.arenaId)];
    for (const id of arenas) assert.equal(getArena(id).look, "quarry");
    for (const region of WORLD.regions.filter((r) => r !== QUARRY)) {
      const looks = [region.arenaId, region.duelArenaId, ...region.spawns.map((s) => s.arenaId ?? region.arenaId)]
        .map((id) => getArena(id).look);
      assert.ok(!looks.includes("quarry"), region.id);
    }
  });
});

describe("the Kobold Shieldbearer", () => {
  test("stands wherever Kobold Swordsmen do, near one, fought in the arena theirs are", () => {
    const kobolds = WORLD.regions.filter((r) => r.spawns.some((s) => s.enemy === "kobold-swordsman"));
    assert.ok(kobolds.length >= 3);
    for (const region of kobolds) {
      const arenaOf = (s: (typeof region.spawns)[number]) => s.arenaId ?? region.arenaId;
      const swordsmen = region.spawns.filter((s) => s.enemy === "kobold-swordsman");
      const shieldbearers = region.spawns.filter((s) => s.enemy === "kobold-shieldbearer");
      assert.ok(shieldbearers.length > 0, region.name);
      for (const s of shieldbearers) {
        const near = swordsmen.find((k) => distXZ(k.at, s.at) < 10);
        assert.ok(near, `${region.name}: one at ${JSON.stringify(s.at)} with no Swordsman near`);
        assert.equal(arenaOf(s), arenaOf(near), region.name);
      }
    }
  });

  test("turns up in the Old Quarry's scrub too, rarer than the Swordsman", () => {
    const quarry = getRegion("old-quarry").grass!.enemies, weightOf = (id: string) =>
      quarry.find((e) => e.enemy === id)?.weight ?? 0;
    assert.ok(weightOf("kobold-shieldbearer") > 0);
    assert.ok(weightOf("kobold-shieldbearer") < weightOf("kobold-swordsman"));
  });
});
