import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { distXZ, isSolid, tileAt, type NpcId, type Rect, type TileKind, type Vec2 } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getRegion, START_REGION, WORLD } from "../../../src/core/world/index.js";
import { arriveIn, dieIn, offeredQuest, startIn, startSession, talkTo, walkable } from "./helpers.js";

before(() => initPhysics());

const KINGDOM = getRegion("kingdom");
const MARKET = getRegion("market-ward");
const SHOPKEEPERS: NpcId[] = ["grocer", "apothecary", "smith", "changer"];
const HERALD_REACH_TILES = 5;
const SQUARE_REACH_TILES = 22;


describe("Highmere's Castle Ward", () => {
  test("is where a new character first wakes, on its summoning platform", () => {
    assert.equal(START_REGION, "kingdom");
    assert.equal(KINGDOM.name, "Highmere: Castle Ward");
    const { session, link } = startSession({ saved: { pad: "kingdom" } });
    assert.deepEqual(link.last("world").me, KINGDOM.spawn);
    assert.equal(tileAt(WORLD.layout, KINGDOM.spawn.x, KINGDOM.spawn.z), "pad");
    assert.equal(session.region, "kingdom");
  });

  test("its castle gate leads down to the Market Ward, a walk away, and nowhere else", () => {
    assert.ok(walkable(KINGDOM.spawn, MARKET.spawn));
    for (const region of WORLD.regions.filter((r) => r.id !== "kingdom" && r.id !== "market-ward")) {
      assert.equal(walkable(KINGDOM.spawn, region.spawn, ["kingdom", region.id]), false, region.id);
    }
  });

  test("a herald stands by the platform and greets a new avatar, sending them to the training yard", () => {
    const stop = stopFor(newStory(), NPCS.herald)!;
    assert.equal(stop.region, "kingdom");
    assert.ok(distXZ(stop.at, KINGDOM.spawn) <= HERALD_REACH_TILES);
    const { session, link } = startSession({ saved: { pad: "kingdom" } });
    const said = talkTo(session, link, "herald");
    assert.ok(said.lines.length > 1);
    assert.equal(offeredQuest(said.offer), "bram-yard");
    assert.ok(said.lines.some((line) => line.includes("Aurevaine")));
  });

  test("King Osric holds court in its throne room: a welcome to the Empire's Door City, and nothing to take", () => {
    assert.equal(stopFor(newStory(), NPCS.king)?.region, "kingdom");
    const { session, link } = startSession({ saved: { pad: "kingdom" } });
    const said = talkTo(session, link, "king");
    assert.equal(said.offer, null);
    const words = said.lines.join(" ");
    for (const name of ["Aurevaine", "Valerian", "Seraphel"]) assert.ok(words.includes(name), name);
  });
});

describe("Highmere's Market Ward", () => {
  test("is named for its city, and is as safe as the castle: no monsters, no campfire, only the butcher's chickens", () => {
    assert.equal(MARKET.name, "Highmere: Market Ward");
    for (const ward of [KINGDOM, MARKET]) {
      assert.deepEqual(ward.spawns, []);
      assert.deepEqual(ward.campfires, []);
      assert.equal(ward.theme, "kingdom");
    }
    assert.equal(KINGDOM.grass, undefined);
    assert.deepEqual(MARKET.grass?.enemies.map((e) => e.enemy), ["chicken"]);
  });

  test("has no summoning pad: a player saved there wakes on the Castle Ward's platform", () => {
    assert.equal(MARKET.hasPad, false);
    const { session, link, saves } = startSession({ saved: { pad: "market-ward" } });
    assert.deepEqual(link.last("world").me, KINGDOM.spawn);
    session.save();
    assert.equal(saves.at(-1)?.pad, "kingdom");
  });

  test("lies between the castle and the wild: its South Gate's road leads down to the Waking Hollow", () => {
    assert.ok(walkable(MARKET.spawn, getRegion("waking-hollow").spawn, ["market-ward", "waking-hollow"]));
  });

  test("is much bigger than the Castle Ward", () => {
    const size = ({ area }: typeof MARKET) => area.w * area.h;
    assert.ok(size(MARKET) > size(KINGDOM));
  });

  test("charges Highmere's prices", () => {
    assert.equal(getRegion("market-ward").priceFactor, getRegion("kingdom").priceFactor);
  });

  test("the food, potion and blacksmith keepers and the money changer stand there, each with a word and their shop", () => {
    const { session, link } = startIn("market-ward");
    for (const npc of SHOPKEEPERS) {
      assert.equal(stopFor(newStory(), NPCS[npc])?.region, "market-ward", npc);
      const said = talkTo(session, link, npc);
      assert.ok(said.lines.length > 0, npc);
      assert.equal(said.offer?.kind, "shop", npc);
    }
  });

  test("the Gilded Door's keeper only talks", () => {
    assert.equal(stopFor(newStory(), NPCS.innkeeper)?.region, "market-ward");
    const { session, link } = startIn("market-ward");
    const said = talkTo(session, link, "innkeeper");
    assert.ok(said.lines.length > 0);
    assert.equal(said.offer, null);
  });
});

describe("Highmere, the old capital", () => {
  const { layout } = WORLD;
  const tilesIn = (area: Rect, kind: TileKind) => {
    const at: Vec2[] = [];
    for (let x = area.x + 0.5; x < area.x + area.w; x++) {
      for (let z = area.z + 0.5; z < area.z + area.h; z++) if (tileAt(layout, x, z) === kind) at.push({ x, z });
    }
    return at;
  };
  const fountain = tilesIn(MARKET.area, "fountain");
  const middle = (at: Vec2[]) => ({
    x: at.reduce((s, p) => s + p.x, 0) / at.length, z: at.reduce((s, p) => s + p.z, 0) / at.length,
  });

  test("a broad way runs straight from the castle's gate past the market's fountain to the South Gate", () => {
    const { x } = middle(fountain), clear = (z: number) => [-2, -1, 0, 1].every((dx) => !isSolid(layout, x + dx + 0.5, z));
    const gate = KINGDOM.area.z + 0.5, south = MARKET.area.z + 0.5;
    const fountainZ = fountain.map((p) => p.z);
    for (let z = south; z <= gate; z++) {
      if (z < Math.min(...fountainZ) - 1 || z > Math.max(...fountainZ) + 1) assert.ok(clear(z), `blocked at z ${z}`);
    }
    assert.ok(walkable({ x, z: south }, KINGDOM.spawn));
  });

  test("its market square has a fountain, statues and lamps, with every keeper's stall round the fountain", () => {
    assert.ok(fountain.length >= 9);
    assert.ok(tilesIn(MARKET.area, "statue").length > 0);
    assert.ok(tilesIn(MARKET.area, "lamp").length > 0);
    for (const npc of SHOPKEEPERS) {
      assert.ok(distXZ(stopFor(newStory(), NPCS[npc])!.at, middle(fountain)) < SQUARE_REACH_TILES, npc);
    }
  });

  test("the castle's courtyard and garden have statues and lamps of their own", () => {
    assert.ok(tilesIn(KINGDOM.area, "statue").length > 0);
    assert.ok(tilesIn(KINGDOM.area, "lamp").length > 0);
  });

  test("is walled in: the land round both wards is masonry", () => {
    for (const id of ["kingdom", "market-ward"]) {
      const { area } = getRegion(id);
      assert.equal(tileAt(layout, area.x - 1.5, area.z + area.h / 2), "castleWall", id);
    }
  });
});

describe("dying", () => {
  test("anywhere, bound to no other pad, wakes you on the kingdom's platform", () => {
    const { session, link } = startSession({ cheats: true, saved: { pad: "kingdom" } });
    arriveIn(session, "grass-field");
    dieIn(session);
    assert.equal(link.last("battleResult").won, false);
    assert.deepEqual(link.last("battleResult").me, KINGDOM.spawn);
    session.leaveBattle();
    assert.equal(session.region, "kingdom");
  });

  test("in the kingdom itself wakes you on its platform", () => {
    const { session, link } = startSession({ cheats: true, saved: { pad: "kingdom" } });
    session.overworld.place(session.me, stopFor(newStory(), NPCS.bram)!.at);
    dieIn(session);
    assert.deepEqual(link.last("battleResult").me, KINGDOM.spawn);
    session.leaveBattle();
    assert.equal(session.region, "kingdom");
    assert.deepEqual(session.overworld.playerPos(session.me), KINGDOM.spawn);
  });
});
