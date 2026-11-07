import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import {
  addItem, bagCounts, emptyBag, Health, packFor, IDLE_INPUT, type Bag, type ItemCounts,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS, type QuestStep, type Task } from "../../../src/core/content/quests.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory, type Story } from "../../../src/core/game/story.js";
import { dialogueOf, stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { bagWith, offeredQuest, pileAt, startSession, tick, winFight } from "./helpers.js";

before(() => initPhysics());

const STOP = stopFor(newStory(), NPCS.hollis)!;
const OPENING = dialogueOf(STOP.talk, newStory(), { bag: emptyBag(), pack: packFor(null), quiver: packFor(null) })!;
assert.ok(OPENING.offer?.kind === "quest", "Hollis offers a quest the first time");
const FIRST = OPENING.offer.quest;
const SECOND = Object.keys(QUESTS).find((id) => {
  const when = QUESTS[id]!.when;
  return when !== undefined && "done" in when && when.done === FIRST;
})!;
const first = QUESTS[FIRST]!, second = QUESTS[SECOND]!;

function stepOf<K extends Task["kind"]>(steps: readonly QuestStep[], kind: K): [Extract<Task, { kind: K }>, QuestStep] {
  const found = steps.find((s) => s.task.kind === kind);
  assert.ok(found, `a ${kind} step`);
  return [found.task as Extract<Task, { kind: K }>, found];
}
const [GATHER, GATHER_STEP] = stepOf(first.steps, "gather");
const [DELIVER, DELIVER_STEP] = stepOf(first.steps, "deliver");
const [KILL, KILL_STEP] = stepOf(second.steps, "kill");
const [, TALK_STEP] = stepOf(second.steps, "talk");
const after = (steps: readonly QuestStep[], step: QuestStep) => steps[steps.indexOf(step) + 1] ?? null;

const rewardItems = (step: QuestStep): ItemCounts => step.reward?.items ?? {};
const rewardLore = (step: QuestStep) => (step.reward?.lore ?? []).map((id) => LORE[id]);
const rewardFlags = (step: QuestStep) => step.reward?.flags ?? [];

const on = (quest: string, step: QuestStep, kills = 0): Story => {
  const done = quest === SECOND ? { [FIRST]: { step: null, kills: 0 } } : {};
  return { ...newStory(), quests: { ...done, [quest]: { step: step.id, kills } } };
};

function faceHollis(session: GameSession): void {
  session.overworld.place(session.me, { x: STOP.at.x + 1, z: STOP.at.z });
  session.overworld.playerData(session.me).heading = "west";
}

function started(opts: { story?: Story; bag?: Bag } = {}) {
  const begun = startSession({
    cheats: true, saved: { story: opts.story ?? newStory(), bag: opts.bag ?? emptyBag(), pad: STOP.region },
  });
  faceHollis(begun.session);
  return begun;
}

describe("Hollis's quests", () => {
  test("the first time, Hollis offers his first quest after his opening lines", () => {
    const { session, link } = started();
    session.talk();
    assert.deepEqual(link.last("dialogue"), {
      t: "dialogue", npc: "hollis", trace: false, lines: OPENING.lines,
      offer: { kind: "quest", quest: FIRST, title: first.title, step: first.steps[0]!.text },
    });
  });

  test("accepted, it's on its first step, in the questbook (and told), and saved", () => {
    const { session, link, saves } = started();
    session.acceptQuest(FIRST);
    const msg = link.last("questbook");
    assert.deepEqual(msg.quests.map((q) => [q.id, q.step?.text]), [[FIRST, first.steps[0]!.text]]);
    assert.deepEqual(msg.news, [{ kind: "taken", quest: first.title, step: first.steps[0]!.text }]);
    assert.deepEqual(saves.at(-1)!.story.quests[FIRST], { step: first.steps[0]!.id, kills: 0 });
    session.acceptQuest(FIRST);
    assert.equal(link.all("questbook").length, 1, "taken already");
  });

  test("only from Hollis in reach and in view, only what he offers, and not mid-fight", () => {
    const { session, link } = started();
    session.acceptQuest(SECOND);
    session.acceptQuest("no-such-quest");
    session.deliver(FIRST);
    session.overworld.place(session.me, { x: STOP.at.x + 5, z: STOP.at.z });
    session.acceptQuest(FIRST);
    faceHollis(session);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.acceptQuest(FIRST);
    assert.equal(link.all("questbook").length, 0);
    assert.deepEqual(session.story, newStory());
  });

  test("gathering: done once the bag holds enough hides, counted as they come", () => {
    const { session, link } = started({ story: on(FIRST, GATHER_STEP) });
    session.bag = bagWith({ [GATHER.item]: GATHER.count - 1 });
    tick(session);
    assert.equal(session.story.quests[FIRST]!.step, GATHER_STEP.id);
    session.bag = bagWith({ [GATHER.item]: GATHER.count });
    tick(session);
    const next = after(first.steps, GATHER_STEP);
    assert.equal(session.story.quests[FIRST]!.step, next?.id ?? null);
    assert.equal(bagCounts(session.bag)[GATHER.item], GATHER.count, "kept: gathering hands nothing over");
    assert.deepEqual(link.last("questbook").news, [{
      kind: "advanced", quest: first.title, next: next?.text ?? null, gained: {}, dropped: {}, lore: [],
    }]);
  });

  test("with enough hides Hollis asks for them; handed over, they leave the bag and the reward comes", () => {
    const { session, link, saves } = started({ story: on(FIRST, DELIVER_STEP), bag: bagWith({ [DELIVER.item]: 3 }) });
    session.talk();
    assert.deepEqual(link.last("dialogue").offer, {
      kind: "deliver", quest: FIRST, item: DELIVER.item, count: DELIVER.count,
    });
    session.deliver(FIRST);
    assert.deepEqual(bagCounts(session.bag), { [DELIVER.item]: 3 - DELIVER.count, ...rewardItems(DELIVER_STEP) });
    assert.deepEqual(link.last("gear").gear.bag, session.bag);
    assert.deepEqual(link.last("questbook").news, [{
      kind: "advanced", quest: first.title, next: after(first.steps, DELIVER_STEP)?.text ?? null,
      gained: rewardItems(DELIVER_STEP), dropped: {}, lore: rewardLore(DELIVER_STEP).map((l) => l.title),
    }]);
    assert.deepEqual(saves.at(-1)!.bag, session.bag);
    session.talk();
    assert.equal(offeredQuest(link.last("dialogue").offer), SECOND, "the next quest is offered");
  });

  test("a reward that doesn't fit is left in a pile at your feet", () => {
    const reward = rewardItems(TALK_STEP);
    assert.ok(Object.keys(reward).length > 0, "the talk step gives items");
    const full = bagWith({ "boar-tusk": 12 });
    assert.equal(addItem(full, "boar-meat", 1).left, 1, "the bag is full");
    const { session, link } = started({ story: on(SECOND, TALK_STEP), bag: full });
    session.talk();
    const news = link.last("questbook").news[0];
    assert.ok(news?.kind === "advanced");
    assert.deepEqual([news.gained, news.dropped], [{}, reward]);
    const pile = pileAt(session.overworld, session.overworld.playerPos(session.me));
    assert.ok(pile !== null, "a pile where they stand");
    assert.deepEqual(bagCounts(session.overworld.pileItems(pile)!), reward);
  });

  test("too few, someone else's, or out of reach: nothing is handed over", () => {
    const bag = bagWith({ [DELIVER.item]: DELIVER.count - 1 });
    const { session, link } = started({ story: on(FIRST, DELIVER_STEP), bag });
    session.talk();
    assert.equal(link.last("dialogue").offer, null);
    session.deliver(FIRST);
    session.bag = bagWith({ [DELIVER.item]: DELIVER.count });
    session.deliver(SECOND);
    session.acceptQuest(FIRST);
    session.overworld.place(session.me, { x: STOP.at.x + 5, z: STOP.at.z });
    session.deliver(FIRST);
    assert.equal(session.story.quests[FIRST]!.step, DELIVER_STEP.id);
    assert.equal(bagCounts(session.bag)[DELIVER.item], DELIVER.count);
  });

  test("won fights count the step's enemy, told each time, until there are enough", () => {
    const { session, link } = started({ story: on(SECOND, KILL_STEP) });
    const other = (["kobold-swordsman", "wild-boar"] as const).find((e) => e !== KILL.enemy)!;
    winFight(session, other);
    assert.equal(session.story.quests[SECOND]!.kills, 0, "another kind of enemy");
    for (let kills = 1; kills < KILL.count; kills++) {
      winFight(session, KILL.enemy);
      assert.deepEqual(session.story.quests[SECOND], { step: KILL_STEP.id, kills });
      const tally = { kind: "tally", quest: second.title, have: kills, need: KILL.count };
      assert.deepEqual(link.last("questbook").news, [tally]);
    }
    winFight(session, KILL.enemy);
    assert.deepEqual(session.story.quests[SECOND], { step: after(second.steps, KILL_STEP)?.id ?? null, kills: 0 });
  });

  test("the talk step: Hollis tells what it reveals, and it's done with its reward; then he says what's next", () => {
    const { session, link } = started({ story: on(SECOND, TALK_STEP) });
    const told = dialogueOf(STOP.talk, session.story, session.gear)!;
    const forStep = STOP.talk.find((t) => isDeepStrictEqual(t.when, { quest: SECOND, step: TALK_STEP.id }));
    assert.equal(told.lines, forStep?.lines, "his lines for that step");
    session.talk();
    assert.deepEqual(link.last("dialogue").lines, told.lines);
    assert.deepEqual(link.last("dialogue").offer, null);
    assert.equal(session.story.quests[SECOND]!.step, after(second.steps, TALK_STEP)?.id ?? null);
    for (const flag of rewardFlags(TALK_STEP)) assert.ok(session.story.flags.includes(flag), flag);
    const book = link.last("questbook").quests.find((q) => q.id === SECOND)!;
    assert.deepEqual(book.lore, second.steps.slice(0, second.steps.indexOf(TALK_STEP) + 1).flatMap(rewardLore));
    session.talk();
    assert.notDeepEqual(link.last("dialogue").lines, told.lines);
  });

  test("dying keeps the story", () => {
    const { session, saves } = started({ story: on(SECOND, KILL_STEP, 1) });
    session.cheat({ kind: "encounter", enemy: KILL.enemy });
    const fight = session.battle!.room.fight;
    fight.world.require(fight.players[0]!, Health).hp = 0;
    for (let i = 0; i < 5 && !session.battle!.over; i++) {
      const next = fight.steps + 1;
      session.battleInput(next, [{ step: next, ...IDLE_INPUT }]);
      session.tick();
    }
    assert.deepEqual(session.story, on(SECOND, KILL_STEP, 1));
    assert.deepEqual(saves.at(-1)!.story, on(SECOND, KILL_STEP, 1));
  });

  test("welcome carries the questbook: empty for a new player, what they've taken for one coming back", () => {
    assert.deepEqual(startSession().link.last("welcome").questbook, []);
    const { link } = startSession({ saved: { story: on(SECOND, KILL_STEP) } });
    const book = link.last("welcome").questbook;
    assert.deepEqual(book.map((q) => [q.id, q.step === null]), [[SECOND, false], [FIRST, true]]);
  });
});
