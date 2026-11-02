import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import {
  addItem, bagCounts, CLOSE_CODES, coreAtStep, emptyBag, FIXED_DT, Health, IDLE_INPUT, newCore, Player, Stamina,
  type ItemCounts, type ItemId,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { fullVitals, newPlayer, PLAYER_STATS } from "../../../src/core/content/player.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import { holds, newStory, type Story } from "../../../src/core/game/story.js";
import type { PlayerSave } from "../../../src/core/ports.js";
import { START_LEVEL } from "../../../src/core/world/index.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { ACCOUNT, bagWith, startSession } from "./helpers.js";

before(() => initPhysics());

const FULL = fullVitals(PLAYER_STATS);
const HURT = { hp: 10, stamina: 3 };
/** Long enough for the boar to charge and bite a player standing still, more than once. */
const IDLE_TIME = 12;

const fightOf = (session: GameSession): Fight => {
  const room = session.battle?.room;
  if (!room) throw new Error("not in a battle");
  return room.fight;
};
const myHp = (session: GameSession) => fightOf(session).world.require(fightOf(session).players[0]!, Health).hp;

function standStill(session: GameSession, seconds: number): void {
  const fight = fightOf(session);
  for (let i = 0; i < seconds / FIXED_DT && session.battle && !session.battle.over; i++) {
    const step = fight.steps + 1;
    session.battleInput(step, [{ step, ...IDLE_INPUT }]);
    session.tick();
  }
}

const fightBoar = (session: GameSession) => session.cheat({ kind: "encounter", enemy: "wild-boar" });

describe("on a production server", () => {
  test("every cheat is ignored", () => {
    const { session, link, saves } = startSession({ dev: false, saved: { vitals: { ...HURT } } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.cheat({ kind: "invulnerable", on: true });
    session.cheat({ kind: "give", item: "boar-meat", count: 3 });
    session.cheat({ kind: "heal" });
    session.cheat({ kind: "completeQuest" });
    session.cheat({ kind: "resetSave" });
    assert.equal(link.open, true);
    assert.equal(session.battle, null);
    assert.deepEqual(session.vitals, HURT);
    assert.deepEqual(session.bag, emptyBag());
    assert.equal(saves.length, 0);
    assert.deepEqual(link.sent.map((m) => m.t).filter((t) => t !== "welcome" && t !== "level"), []);
  });
});

describe("encounter", () => {
  test("starts a battle against the enemy asked for", () => {
    const { session, link } = startSession({ dev: true });
    session.cheat({ kind: "encounter", enemy: "kobold-swordsman" });
    assert.ok(session.battle);
    assert.equal(link.last("encounter").setup.enemies[0]?.def.id, "kobold-swordsman");
  });

  test("does nothing mid-battle, or before the player has a level", () => {
    const inFight = startSession({ dev: true });
    fightBoar(inFight.session);
    fightBoar(inFight.session);
    assert.equal(inFight.link.all("encounter").length, 1);
    const making = startSession({ dev: true, saved: { character: null } });
    fightBoar(making.session);
    assert.equal(making.link.all("encounter").length, 0);
  });
});

describe("invulnerable", () => {
  test("is said back, isn't saved, and goes into the next fight", () => {
    const { session, link, saves } = startSession({ dev: true });
    session.cheat({ kind: "invulnerable", on: true });
    assert.equal(link.last("invulnerable").on, true);
    assert.equal(saves.length, 0);
    fightBoar(session);
    assert.equal(link.last("encounter").setup.players[0]?.invulnerable, true);
  });

  test("a fight with it on: the boar does no damage", () => {
    const control = startSession({ dev: true });
    fightBoar(control.session);
    standStill(control.session, IDLE_TIME);
    assert.ok(myHp(control.session) < FULL.hp, "the boar hurts a player without it");

    const { session } = startSession({ dev: true });
    session.cheat({ kind: "invulnerable", on: true });
    fightBoar(session);
    standStill(session, IDLE_TIME);
    assert.equal(myHp(session), FULL.hp);
  });

  test("turned on mid-fight: the fight's player has it at once, and the client gets the fight", () => {
    const { session, link } = startSession({ dev: true });
    fightBoar(session);
    standStill(session, 0.5);
    const syncs = link.all("battleSync").length;
    session.cheat({ kind: "invulnerable", on: true });
    const fight = fightOf(session);
    assert.equal(fight.world.require(fight.players[0]!, Player).invulnerable, true);
    assert.equal(link.all("battleSync").length, syncs + 1);
    assert.equal(link.last("battleSync").fight.players[0]?.player.invulnerable, true);
    const hp = myHp(session);
    standStill(session, IDLE_TIME);
    assert.equal(myHp(session), hp);
  });
});

describe("give", () => {
  test("packs the items into the bag, saves, and says what was given", () => {
    const { session, link, saves } = startSession({ dev: true });
    session.cheat({ kind: "give", item: "boar-meat", count: 7 });
    assert.deepEqual(bagCounts(session.bag), { "boar-meat": 7 });
    assert.deepEqual(saves.at(-1)?.bag, session.bag);
    const given = link.last("given");
    assert.deepEqual([given.item, given.count, given.left], ["boar-meat", 7, 0]);
    assert.deepEqual(given.gear, session.gear);
  });

  test("a full bag keeps what fits and says how many were left out", () => {
    const { session, link } = startSession({ dev: true });
    const fits = addItem(emptyBag(), "boar-hide", 1000).bag;
    const fitCount = (bagCounts(fits) as ItemCounts)["boar-hide"] ?? 0;
    session.cheat({ kind: "give", item: "boar-hide", count: fitCount + 3 });
    assert.deepEqual(bagCounts(session.bag), { "boar-hide": fitCount });
    const given = link.last("given");
    assert.deepEqual([given.count, given.left], [fitCount, 3]);
  });

  test("does nothing in a battle: the fight has the bag", () => {
    const { session, link } = startSession({ dev: true });
    fightBoar(session);
    session.cheat({ kind: "give", item: "boar-meat", count: 1 });
    assert.equal(link.all("given").length, 0);
    assert.deepEqual(session.bag, emptyBag());
  });
});

describe("heal", () => {
  test("refills HP and stamina anywhere, saves, and says so", () => {
    const { session, link, saves } = startSession({ dev: true, saved: { vitals: { ...HURT } } });
    session.cheat({ kind: "heal" });
    assert.deepEqual(session.vitals, FULL);
    assert.deepEqual(saves.at(-1)?.vitals, FULL);
    assert.deepEqual(link.last("healed").vitals, FULL);
  });

  test("in a fight refills the fight's HP and stamina, and the client gets the fight", () => {
    const { session, link } = startSession({ dev: true, saved: { vitals: { ...HURT } } });
    fightBoar(session);
    standStill(session, 0.2);
    session.cheat({ kind: "heal" });
    const fight = fightOf(session), me = fight.players[0]!;
    assert.equal(fight.world.require(me, Health).hp, FULL.hp);
    assert.equal(fight.world.require(me, Stamina).value, fight.world.require(me, Stamina).max);
    assert.equal(link.last("battleSync").fight.players[0]?.health.hp, FULL.hp);
  });
});

describe("completeQuest", () => {
  const MAIN = Object.keys(QUESTS).filter((id) => QUESTS[id]!.half === "main");
  const SIDE = Object.keys(QUESTS).filter((id) => QUESTS[id]!.half === "side");
  const DELIVERING = MAIN.find((id) => QUESTS[id]!.steps.some((s) => s.task.kind === "deliver"))!;
  const IDLE_SIDE = SIDE.find((id) => ["kill", "talk"].includes(QUESTS[id]!.steps[0]!.task.kind))!;
  const storyOf = (steps: Record<string, string | null>): Story => ({
    ...newStory(), quests: Object.fromEntries(Object.entries(steps).map(([id, step]) => [id, { step, kills: 0 }])),
  });
  const firstStep = (id: string) => QUESTS[id]!.steps[0]!;
  const onFirstStep = (...ids: string[]) => storyOf(Object.fromEntries(ids.map((id) => [id, firstStep(id).id])));
  const complete = (session: GameSession) => session.cheat({ kind: "completeQuest" });

  test("finishes the main quest in progress before any side quest: every step, as if done", () => {
    const quest = QUESTS[DELIVERING]!;
    const deliver = quest.steps.find((s) => s.task.kind === "deliver")!.task as { item: ItemId; count: number };
    const { session, link, saves } = startSession({
      dev: true, saved: { story: onFirstStep(IDLE_SIDE, DELIVERING), bag: bagWith({ [deliver.item]: deliver.count }) },
    });
    const expected: ItemCounts = { ...bagCounts(session.bag) };
    expected[deliver.item] = (expected[deliver.item] ?? 0) - deliver.count;
    for (const step of quest.steps) {
      for (const [item, count] of Object.entries(step.reward?.items ?? {}) as [ItemId, number][]) {
        expected[item] = (expected[item] ?? 0) + count;
      }
    }
    complete(session);
    assert.equal(session.story.quests[DELIVERING]?.step, null);
    assert.equal(session.story.quests[IDLE_SIDE]?.step, firstStep(IDLE_SIDE).id);
    const have = bagCounts(session.bag) as ItemCounts;
    for (const [item, count] of Object.entries(expected) as [ItemId, number][]) {
      assert.equal(have[item] ?? 0, count, item);
    }
    for (const flag of quest.steps.flatMap((s) => s.reward?.flags ?? [])) assert.ok(session.story.flags.includes(flag));
    assert.deepEqual(saves.at(-1)?.story, session.story);
    const news = link.last("questbook").news;
    assert.deepEqual(news.at(-1), { ...news.at(-1), kind: "advanced", quest: quest.title, next: null });
  });

  test("with none in progress, takes the first main quest that can start: clicks walk the main story", () => {
    const { session, link } = startSession({ dev: true, saved: { story: newStory() } });
    const first = MAIN.find((id) => holds({ canStart: id }, newStory()))!;
    complete(session);
    const taken = { kind: "taken", quest: QUESTS[first]!.title, step: firstStep(first).text };
    assert.deepEqual(link.last("questbook").news[0], taken);
    for (let i = 1; i < MAIN.length; i++) complete(session);
    for (const id of MAIN) assert.equal(session.story.quests[id]?.step, null, id);
    for (const id of SIDE) assert.equal(session.story.quests[id], undefined, id);
  });

  test("with every quest done, says so and changes nothing", () => {
    const done = storyOf(Object.fromEntries(Object.keys(QUESTS).map((id) => [id, null])));
    const { session, link, saves } = startSession({ dev: true, saved: { story: done } });
    const questbooks = link.all("questbook").length;
    complete(session);
    assert.equal(link.all("noQuest").length, 1);
    assert.equal(link.all("questbook").length, questbooks);
    assert.equal(saves.length, 0);
  });

  test("does nothing in a battle", () => {
    const story = onFirstStep(DELIVERING);
    const { session } = startSession({ dev: true, saved: { story } });
    fightBoar(session);
    complete(session);
    assert.deepEqual(session.story, story);
  });
});

describe("resetSave", () => {
  const SETTINGS = { camera: { sensitivity: 2 } };
  const played = (): PlayerSave => ({
    ...newPlayer(), character: TEST_CHARACTER, settings: SETTINGS, vitals: { ...HURT }, wins: 5,
    bag: bagWith({ "boar-meat": 3 }), shopsBought: ["grocer"], level: "grass-field", knownWords: ["bolt"],
    story: { quests: { [Object.keys(QUESTS)[0]!]: { step: null, kills: 0 } }, flags: ["x"] },
    core: coreAtStep(newCore(), 3),
  });
  const fresh = (): PlayerSave => ({ ...newPlayer(), character: TEST_CHARACTER, settings: SETTINGS });

  test("saves a brand-new player keeping the character and settings, and sends the client back through login", () => {
    const { session, link, saves } = startSession({ dev: true, saved: played() });
    session.cheat({ kind: "resetSave" });
    assert.deepEqual(saves.at(-1), fresh());
    assert.equal(link.closed?.code, CLOSE_CODES.saveReset);
    const count = saves.length;
    session.saveSoon();
    session.disconnect();
    assert.ok(saves.slice(count).every((s) => isDeepStrictEqual(s, fresh())), "nothing after it undoes the reset");
  });

  test("joining again starts as a new player does, at the start", async () => {
    const store = new MemoryPlayerStore();
    store.saved.set(ACCOUNT.id, played());
    const online = new OnlinePlayers(store, true, 50);
    const session = await online.join(new FakeLink(), ACCOUNT);
    session!.cheat({ kind: "resetSave" });
    online.leave(session!);
    const link = new FakeLink();
    await online.join(link, ACCOUNT);
    const welcome = link.last("welcome");
    assert.deepEqual([welcome.wins, welcome.questbook, welcome.character], [0, [], TEST_CHARACTER]);
    assert.deepEqual(welcome.core, newCore());
    assert.equal(link.last("level").level.id, START_LEVEL);
  });

  test("does nothing in a battle", () => {
    const { session, link, saves } = startSession({ dev: true, saved: played() });
    fightBoar(session);
    const count = saves.length;
    session.cheat({ kind: "resetSave" });
    assert.equal(link.open, true);
    assert.equal(saves.length, count);
  });
});
