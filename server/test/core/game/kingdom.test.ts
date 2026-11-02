import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { distXZ, Health, IDLE_INPUT, tileAt, type NpcId } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import { offeredQuest, startSession, talkTo, tick } from "./helpers.js";

before(() => initPhysics());

const KINGDOM = getLevel("kingdom");
const SHOPKEEPERS: NpcId[] = ["grocer", "apothecary", "smith"];
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

describe("the kingdom", () => {
  test("is where a new character first wakes, on its summoning platform", () => {
    assert.equal(START_LEVEL, "kingdom");
    const { session, link } = startSession({ saved: { level: null } });
    assert.equal(link.last("level").level.id, "kingdom");
    assert.deepEqual(link.last("level").me, KINGDOM.spawn);
    assert.equal(tileAt(KINGDOM.layout, KINGDOM.spawn.x, KINGDOM.spawn.z), "pad");
    assert.equal(session.overworld.level.layout.id, "kingdom");
  });

  test("has no enemies, no tall-grass fights and no campfire", () => {
    assert.deepEqual(KINGDOM.spawns, []);
    assert.equal(KINGDOM.grass, undefined);
    assert.deepEqual(KINGDOM.layout.campfires, []);
  });

  test("its gate leads out to the Grass Field", () => {
    assert.ok(KINGDOM.exits.some((e) => e.to === "grass-field"));
  });

  test("a herald stands by the platform and greets a new avatar, sending them to the training yard", () => {
    const stop = stopFor(newStory(), NPCS.herald)!;
    assert.equal(stop.level, "kingdom");
    assert.ok(distXZ(stop.at, KINGDOM.spawn) <= HERALD_REACH_TILES);
    const { session, link } = startSession({ saved: { level: null } });
    const said = talkTo(session, link, "herald");
    assert.ok(said.lines.length > 1);
    assert.equal(offeredQuest(said.offer), "bram-yard");
  });

  test("the food, potion and blacksmith keepers stand in town, each with a word and their shop", () => {
    const { session, link } = startSession({ saved: { level: null } });
    for (const npc of SHOPKEEPERS) {
      assert.equal(stopFor(newStory(), NPCS[npc])?.level, "kingdom", npc);
      const said = talkTo(session, link, npc);
      assert.ok(said.lines.length > 0, npc);
      assert.equal(said.offer?.kind, "shop", npc);
    }
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
    session.overworld.place(session.me, KINGDOM.exits[0]!.at);
    dieIn(session);
    assert.deepEqual(link.last("battleResult").me, KINGDOM.spawn);
    session.leaveBattle();
    assert.equal(session.overworld.level.layout.id, "kingdom");
    assert.deepEqual(session.overworld.playerPos(session.me), KINGDOM.spawn);
  });
});
