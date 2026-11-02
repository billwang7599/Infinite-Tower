import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  bagCounts, emptyBag, emptyEquipment, Health, IDLE_INPUT, isSolid, type ItemCounts,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { ITEM_VALUES, SELL_SHARE, SHOPS } from "../../../src/core/content/shops.js";
import { TRAINING_YIELD_SHARE } from "../../../src/core/game/training.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import type { PlayerSave } from "../../../src/core/ports.js";
import { getLevel } from "../../../src/core/world/index.js";
import { offeredQuest, startSession, talkTo, tick } from "./helpers.js";

before(() => initPhysics());

const QUEST = "bram-yard";
const KINGDOM = getLevel("kingdom");

const fresh = (saved: Partial<PlayerSave> = {}) =>
  startSession({ saved: { level: null, equipment: emptyEquipment(), knownWords: [], bag: emptyBag(), ...saved } });

const onStep = (step: string | null) => ({ quests: { [QUEST]: { step, kills: 0 } }, flags: [] });

function endFight(session: GameSession, loser: "player" | "enemy"): void {
  const fight = session.battle!.room.fight;
  const e = loser === "player" ? fight.players[0]! : fight.enemies[0]!;
  const health = fight.world.require(e, Health);
  health.hp = health.floor;
  health.regenDelay = 1;
  for (let i = 0; i < 5 && !session.battle!.over; i++) {
    const step = fight.steps + 1;
    session.battleInput(step, [{ step, ...IDLE_INPUT }]);
    tick(session);
  }
  assert.ok(session.battle!.over, "decided");
}

const carried = (session: GameSession): ItemCounts => {
  const counts = bagCounts(session.bag);
  for (const item of Object.values(session.gear.equipment)) if (item) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
};

describe("the training yard", () => {
  test("the herald sends a new avatar to Bram, who stands in a yard off the courtyard", () => {
    const { session, link } = fresh();
    const said = talkTo(session, link, "herald");
    assert.equal(offeredQuest(said.offer), QUEST);
    session.acceptQuest(QUEST);
    assert.equal(session.story.quests[QUEST]?.step, "bram");
    const stop = stopFor(newStory(), NPCS.bram)!;
    assert.equal(stop.level, "kingdom");
    assert.equal(isSolid(KINGDOM.layout, stop.at.x, stop.at.z), false);
  });

  test("Bram hands over the old stick once, on the first talk, and sets up the dummy", () => {
    const { session, link } = fresh({ story: onStep("bram") });
    const said = talkTo(session, link, "bram");
    assert.equal(said.offer?.kind, "train");
    assert.deepEqual(carried(session), { "old-stick": 1 });
    assert.equal(session.story.quests[QUEST]?.step, "dummy");
    talkTo(session, link, "bram");
    assert.deepEqual(carried(session), { "old-stick": 1 });
  });

  test("taking the quest from Bram himself counts as talking to him", () => {
    const { session, link } = fresh();
    const said = talkTo(session, link, "bram");
    assert.equal(offeredQuest(said.offer), QUEST);
    session.acceptQuest(QUEST);
    assert.equal(session.story.quests[QUEST]?.step, "dummy");
    assert.deepEqual(carried(session), { "old-stick": 1 });
  });

  test("the dummy fight is a spar nobody can join; beating it moves on, costing nothing", () => {
    const { session, link } = fresh({ story: onStep("bram") });
    talkTo(session, link, "bram");
    const before = { vitals: { ...session.vitals }, carried: carried(session), wins: session.wins };
    session.train();
    const { room } = session.battle!;
    assert.equal(room.fight.enemies.length, 1);
    assert.equal(room.setup.enemies[0]!.def.id, "training-dummy");
    assert.equal(room.setup.yieldAt, TRAINING_YIELD_SHARE);
    assert.equal(room.refusal, "spar");
    endFight(session, "enemy");
    assert.equal(link.last("battleResult").won, true);
    assert.equal(session.story.quests[QUEST]?.step, "spar");
    session.leaveBattle();
    assert.deepEqual(session.vitals, before.vitals);
    assert.deepEqual(carried(session), before.carried);
    assert.equal(session.wins, before.wins);
  });

  test("losing the spar loses nothing: no death, no drops, the same HP, and Bram will go again", () => {
    const equipment = { ...emptyEquipment(), rightHand: "old-stick" as const };
    const { session, link, saves } = fresh({ story: onStep("spar"), equipment });
    const said = talkTo(session, link, "bram");
    assert.equal(said.offer?.kind, "train");
    const before = { vitals: { ...session.vitals }, carried: carried(session), core: session.core };
    session.train();
    assert.equal(session.battle!.room.setup.enemies[0]!.def.id, "bram");
    endFight(session, "player");
    const result = link.last("battleResult");
    assert.equal(result.won, false);
    assert.deepEqual(result.lost, {});
    assert.equal(result.spar, "Bram");
    session.leaveBattle();
    assert.equal(session.overworld.level.layout.id, "kingdom");
    assert.deepEqual(session.vitals, before.vitals);
    assert.deepEqual(carried(session), before.carried);
    assert.deepEqual(session.core, before.core);
    assert.equal(saves.at(-1)?.level, "kingdom");
    assert.equal(session.story.quests[QUEST]?.step, "spar");
    assert.equal(talkTo(session, link, "bram").offer?.kind, "train");
  });

  test("winning the spar finishes the yard; Bram still spars after", () => {
    const { session, link } = fresh({ story: onStep("spar") });
    talkTo(session, link, "bram");
    session.train();
    endFight(session, "enemy");
    session.leaveBattle();
    assert.equal(session.story.quests[QUEST]?.step, null);
    assert.equal(talkTo(session, link, "bram").offer?.kind, "train");
  });

  test("no fight starts without Bram in view offering one", () => {
    const { session } = fresh({ story: onStep("dummy") });
    session.train();
    assert.equal(session.battle, null);
  });

  test("the smith buys the old stick for a few copper", () => {
    assert.ok(SHOPS.smith.buys.includes("old-stick"));
    const copper = Math.floor(ITEM_VALUES["old-stick"]! * SELL_SHARE);
    assert.ok(copper >= 1 && copper < 10, `${copper}`);
  });
});
