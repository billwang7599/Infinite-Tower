import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  bagCounts, emptyBag, emptyEquipment, Health, IDLE_INPUT, isSolid, type ItemCounts,
} from "@infinite-tower/shared";
import { initPhysics, PLAYER_START } from "@infinite-tower/shared/fight";
import { QUEST_ORDER } from "../../../src/core/content/quests.js";
import { ITEM_VALUES, SELL_SHARE, SHOPS } from "../../../src/core/content/shops.js";
import { DUMMY_SPOTS, TRAINING_YIELD_SHARE } from "../../../src/core/game/training.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import type { PlayerSave } from "../../../src/core/ports.js";
import { WORLD } from "../../../src/core/world/index.js";
import { offeredQuest, startSession, talkTo, tick } from "./helpers.js";

before(() => initPhysics());

const QUEST = "bram-yard";
const fresh = (saved: Partial<PlayerSave> = {}) =>
  startSession({ saved: { pad: "kingdom", equipment: emptyEquipment(), knownWords: [], bag: emptyBag(), ...saved } });

const onStep = (step: string | null) => ({ quests: { [QUEST]: { step, kills: 0 } }, flags: [] });

function knockDown(session: GameSession, loser: "player" | "enemy", count = Infinity): void {
  const fight = session.battle!.room.fight;
  for (const e of (loser === "player" ? fight.players : fight.enemies).slice(0, count)) {
    const health = fight.world.require(e, Health);
    health.hp = health.floor;
    health.regenDelay = 1;
  }
}

function runSteps(session: GameSession, steps: number): void {
  for (let i = 0; i < steps && !session.battle!.over; i++) {
    const step = session.battle!.room.fight.steps + 1;
    session.battleInput(step, [{ step, ...IDLE_INPUT }]);
    tick(session);
  }
}

function endFight(session: GameSession, loser: "player" | "enemy"): void {
  knockDown(session, loser);
  const fight = session.battle!.room.fight;
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
    assert.equal(stop.region, "kingdom");
    assert.equal(isSolid(WORLD.layout, stop.at.x, stop.at.z), false);
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
    const before = { vitals: { ...session.vitals }, carried: carried(session) };
    session.train();
    const { room } = session.battle!;
    assert.equal(room.fight.enemies.length, DUMMY_SPOTS.length);
    assert.ok(room.setup.enemies.every((e) => e.def.id === "training-dummy"));
    assert.equal(room.setup.yieldAt, TRAINING_YIELD_SHARE);
    assert.equal(room.refusal, "spar");
    endFight(session, "enemy");
    assert.equal(link.last("battleResult").won, true);
    assert.equal(session.story.quests[QUEST]?.step, "spar");
    session.leaveBattle();
    assert.deepEqual(session.vitals, before.vitals);
    assert.deepEqual(carried(session), before.carried);
  });

  test("Bram sets up three dummies in a row ahead, the middle one nearest, and all must fall", () => {
    const { session, link } = fresh({ story: onStep("dummy") });
    talkTo(session, link, "bram");
    session.train();
    const { setup } = session.battle!.room;
    assert.equal(DUMMY_SPOTS.length, 3);
    assert.deepEqual(setup.enemies.map((e) => e.at), DUMMY_SPOTS);
    const dist = (at: { x: number; z: number }) => Math.hypot(at.x - PLAYER_START.x, at.z - PLAYER_START.z);
    for (const at of DUMMY_SPOTS) assert.ok(at.z > PLAYER_START.z, "ahead of the player");
    assert.ok(dist(DUMMY_SPOTS[1]!) < dist(DUMMY_SPOTS[0]!) && dist(DUMMY_SPOTS[1]!) < dist(DUMMY_SPOTS[2]!));
    knockDown(session, "enemy", 2);
    runSteps(session, 5);
    assert.equal(session.battle!.over, false, "two down, one standing");
    endFight(session, "enemy");
    assert.equal(link.last("battleResult").won, true);
    assert.equal(session.story.quests[QUEST]?.step, "spar");
  });

  test("Bram spars alone", () => {
    const { session, link } = fresh({ story: onStep("spar") });
    talkTo(session, link, "bram");
    session.train();
    assert.equal(session.battle!.room.setup.enemies.length, 1);
  });

  test("losing the spar loses nothing: no death, no drops, the same HP, and Bram will go again", () => {
    const equipment = { ...emptyEquipment(), rightHand: "old-stick" as const };
    const { session, link } = fresh({ story: onStep("spar"), equipment });
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
    assert.equal(session.region, "kingdom");
    assert.deepEqual(session.vitals, before.vitals);
    assert.deepEqual(carried(session), before.carried);
    assert.deepEqual(session.core, before.core);
    assert.equal(session.story.quests[QUEST]?.step, "spar");
    assert.equal(talkTo(session, link, "bram").offer?.kind, "train");
  });

  test("winning the spar finishes the yard; Bram sends you on with the next quest, and still spars after", () => {
    const { session, link } = fresh({ story: onStep("spar") });
    talkTo(session, link, "bram");
    session.train();
    endFight(session, "enemy");
    session.leaveBattle();
    assert.equal(session.story.quests[QUEST]?.step, null);
    const next = QUEST_ORDER[QUEST_ORDER.indexOf(QUEST) + 1];
    assert.equal(offeredQuest(talkTo(session, link, "bram").offer), next);
    session.acceptQuest(next!);
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
