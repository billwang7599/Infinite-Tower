import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { distXZ, Health, IDLE_INPUT, tileAt, type NpcId } from "@infinite-tower/shared";
import { PRICE_FACTOR } from "../../../src/core/content/shops.js";
import { initPhysics } from "@infinite-tower/shared/fight";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import { arriveIn, offeredQuest, startIn, startSession, talkTo, tick } from "./helpers.js";

before(() => initPhysics());

const KINGDOM = getLevel("kingdom");
const MARKET = getLevel("market-ward");
const SHOPKEEPERS: NpcId[] = ["grocer", "apothecary", "smith", "changer"];
const HERALD_REACH_TILES = 5;

function dieIn(session: GameSession): void {
  session.cheat({ kind: "encounter", enemy: "wild-boar" });
  const fight = session.battle!.room.fight;
  fight.world.require(fight.players[0]!, Health).hp = 0;
  for (let i = 0; i < 3 && !session.battle!.over; i++) {
    const next = fight.steps + 1;
    session.battleInput(next, [{ step: next, ...IDLE_INPUT }]);
    tick(session);
  }
  assert.equal(session.battle!.over, true);
}

describe("Highmere's Castle Ward", () => {
  test("is where a new character first wakes, on its summoning platform", () => {
    assert.equal(START_LEVEL, "kingdom");
    assert.equal(KINGDOM.layout.name, "Highmere: Castle Ward");
    const { session, link } = startSession({ saved: { level: null } });
    assert.equal(link.last("level").level.id, "kingdom");
    assert.deepEqual(link.last("level").me, KINGDOM.spawn);
    assert.equal(tileAt(KINGDOM.layout, KINGDOM.spawn.x, KINGDOM.spawn.z), "pad");
    assert.equal(session.overworld.level.layout.id, "kingdom");
  });

  test("its castle gate leads down to the Market Ward, and only there", () => {
    assert.deepEqual(KINGDOM.exits.map((e) => e.to), ["market-ward"]);
  });

  test("a herald stands by the platform and greets a new avatar, sending them to the training yard", () => {
    const stop = stopFor(newStory(), NPCS.herald)!;
    assert.equal(stop.level, "kingdom");
    assert.ok(distXZ(stop.at, KINGDOM.spawn) <= HERALD_REACH_TILES);
    const { session, link } = startSession({ saved: { level: null } });
    const said = talkTo(session, link, "herald");
    assert.ok(said.lines.length > 1);
    assert.equal(offeredQuest(said.offer), "bram-yard");
    assert.ok(said.lines.some((line) => line.includes("Aurevaine")));
  });

  test("King Osric holds court in its throne room: a welcome to the Empire's Door City, and nothing to take", () => {
    assert.equal(stopFor(newStory(), NPCS.king)?.level, "kingdom");
    const { session, link } = startSession({ saved: { level: null } });
    const said = talkTo(session, link, "king");
    assert.equal(said.offer, null);
    const words = said.lines.join(" ");
    for (const name of ["Aurevaine", "Valerian", "Seraphel"]) assert.ok(words.includes(name), name);
  });
});

describe("Highmere's Market Ward", () => {
  test("is named for its city, and is as safe as the castle: no enemies, no tall-grass fights, no campfire", () => {
    assert.equal(MARKET.layout.name, "Highmere: Market Ward");
    for (const ward of [KINGDOM, MARKET]) {
      assert.deepEqual(ward.spawns, []);
      assert.equal(ward.grass, undefined);
      assert.deepEqual(ward.layout.campfires, []);
      assert.equal(ward.layout.theme, "kingdom");
    }
  });

  test("has no summoning pad: a player saved there wakes on the Castle Ward's platform", () => {
    assert.ok(MARKET.layout.tiles.every((row, r) => [...row].every((_, c) =>
      tileAt(MARKET.layout, c - row.length / 2 + 0.5, MARKET.layout.tiles.length / 2 - r - 0.5) !== "pad")));
    const { session, link, saves } = startSession({ saved: { level: "market-ward" } });
    assert.equal(link.last("level").level.id, "kingdom");
    assert.deepEqual(link.last("level").me, KINGDOM.spawn);
    session.save();
    assert.equal(saves.at(-1)?.level, "kingdom");
  });

  test("walking in through the castle gate still arrives at the gate", () => {
    const { session, link } = startSession({ saved: { level: "kingdom" } });
    arriveIn(session, "market-ward");
    assert.equal(link.last("level").level.id, "market-ward");
    assert.deepEqual(link.last("level").me, KINGDOM.exits.find((e) => e.to === "market-ward")!.at);
  });

  test("lies between the castle and the wild: its gates lead up to the Castle Ward and out to the Grass Field", () => {
    assert.deepEqual(MARKET.exits.map((e) => e.to).sort(), ["grass-field", "kingdom"]);
    assert.ok(getLevel("grass-field").exits.some((e) => e.to === "market-ward"));
    assert.ok(!getLevel("grass-field").exits.some((e) => e.to === "kingdom"));
  });

  test("is much bigger than the Castle Ward", () => {
    const area = (rows: string[]) => rows.length * rows[0]!.length;
    assert.ok(area(MARKET.layout.tiles) > area(KINGDOM.layout.tiles));
  });

  test("charges Highmere's prices", () => {
    assert.equal(PRICE_FACTOR["market-ward"], PRICE_FACTOR.kingdom);
  });

  test("the food, potion and blacksmith keepers and the money changer stand there, each with a word and their shop", () => {
    const { session, link } = startIn("market-ward");
    for (const npc of SHOPKEEPERS) {
      assert.equal(stopFor(newStory(), NPCS[npc])?.level, "market-ward", npc);
      const said = talkTo(session, link, npc);
      assert.ok(said.lines.length > 0, npc);
      assert.equal(said.offer?.kind, "shop", npc);
    }
  });

  test("the Gilded Door's keeper only talks", () => {
    assert.equal(stopFor(newStory(), NPCS.innkeeper)?.level, "market-ward");
    const { session, link } = startIn("market-ward");
    const said = talkTo(session, link, "innkeeper");
    assert.ok(said.lines.length > 0);
    assert.equal(said.offer, null);
  });
});

describe("dying", () => {
  test("anywhere wakes you on the kingdom's platform once you leave the arena", () => {
    const { session, link, saves } = startSession({ dev: true, saved: { level: "grass-field" } });
    dieIn(session);
    assert.equal(link.last("battleResult").won, false);
    assert.equal(saves.at(-1)?.level, "kingdom");
    session.leaveBattle();
    assert.equal(link.last("level").level.id, "kingdom");
    assert.deepEqual(link.last("level").me, KINGDOM.spawn);
    assert.equal(session.overworld.level.layout.id, "kingdom");
  });

  test("and disconnecting mid-fight, a death too, saves you there", () => {
    const { session, saves } = startSession({ dev: true, saved: { level: "mistwood" } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.disconnect();
    assert.equal(saves.at(-1)?.level, "kingdom");
  });

  test("in the kingdom itself wakes you on its platform", () => {
    const { session, link } = startSession({ dev: true, saved: { level: "kingdom" } });
    session.overworld.place(session.me, stopFor(newStory(), NPCS.bram)!.at);
    dieIn(session);
    assert.deepEqual(link.last("battleResult").me, KINGDOM.spawn);
    session.leaveBattle();
    assert.equal(session.overworld.level.layout.id, "kingdom");
    assert.deepEqual(session.overworld.playerPos(session.me), KINGDOM.spawn);
  });
});
