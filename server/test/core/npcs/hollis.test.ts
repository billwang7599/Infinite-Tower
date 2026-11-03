import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import type { Vec2 } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory, type Story } from "../../../src/core/game/story.js";
import { dialogueOf, stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import type { FakeLink } from "../../fixtures/fakes.js";
import { arriveIn, startSession, talkTo } from "../game/helpers.js";

before(() => initPhysics());

const FIRE = stopFor(newStory(), NPCS.hollis)!;
const AWAY = NPCS.hollis.stops[0]!;
assert.ok(AWAY.when && "flag" in AWAY.when, "his next stop waits on a flag");
const MOVES = AWAY.when.flag;
const [CHAIN_END, MOVING_STEP] = Object.entries(QUESTS).flatMap(([id, quest]) =>
  quest.steps.filter((s) => s.reward?.flags?.includes(MOVES)).map((s) => [id, s] as const))[0]!;
assert.ok(MOVING_STEP.task.kind === "talk" && MOVING_STEP.task.to === "hollis", "said goodbye by the fire");
const TRACE = FIRE.trace!;

const story = (quests: Story["quests"], flags: string[] = []): Story => ({ quests, flags });
const ON_MOVING_STEP = story({ [CHAIN_END]: { step: MOVING_STEP.id, kills: 0 } });
const MOVED = story({ [CHAIN_END]: { step: null, kills: 0 } }, [MOVES]);

const hollisIn = (link: FakeLink) => link.placed().npcs.filter((n) => n.npc === "hollis");
const tracesIn = (link: FakeLink) => link.placed().traces;

function face(session: GameSession, at: Vec2): void {
  session.overworld.place(session.me, { x: at.x + 1, z: at.z });
  session.overworld.playerData(session.me).heading = "west";
}

describe("Hollis moves on to the Mistwood", () => {
  test("until his first chain is done he keeps the Grass Field's fire, and has left nothing there", () => {
    assert.equal(FIRE.region, "grass-field");
    for (const pad of [FIRE.region, AWAY.region]) {
      const { link } = startSession({ saved: { pad, story: ON_MOVING_STEP } });
      assert.deepEqual(hollisIn(link), [{ npc: "hollis", at: FIRE.at, heading: FIRE.heading }]);
      assert.deepEqual(tracesIn(link), []);
    }
  });

  test("once it's done, a player finds him in the Mistwood, and what he left where he stood by the fire", () => {
    assert.equal(AWAY.region, "mistwood");
    const { link } = startSession({ saved: { pad: FIRE.region, story: MOVED } });
    assert.deepEqual(hollisIn(link), [{ npc: "hollis", at: AWAY.at, heading: AWAY.heading }]);
    assert.deepEqual(tracesIn(link), [TRACE.at]);
  });

  test("he says goodbye in person: still by the fire, saying where he's going, until the player walks off", () => {
    const { session, link } = startSession({ saved: { pad: FIRE.region, story: ON_MOVING_STEP } });
    talkTo(session, link, "hollis");
    assert.ok(session.story.flags.includes(MOVES));
    const goodbye = FIRE.talk.find((t) => isDeepStrictEqual(t.when, { flag: MOVES }));
    assert.ok(goodbye, "lines for after the chain, at the fire");
    assert.deepEqual(talkTo(session, link, "hollis").lines, goodbye.lines);
    assert.deepEqual(hollisIn(link), [{ npc: "hollis", at: FIRE.at, heading: FIRE.heading }]);
    arriveIn(session, AWAY.region);
    assert.deepEqual(hollisIn(link), [{ npc: "hollis", at: AWAY.at, heading: AWAY.heading }]);
    assert.deepEqual(tracesIn(link), [TRACE.at]);
  });

  test("facing what he left, Interact reads it as his trace, and does no step that waits on him", () => {
    const stillOwed = { ...ON_MOVING_STEP, flags: [MOVES] };
    const { session, link, saves } = startSession({ saved: { pad: FIRE.region, story: stillOwed } });
    const saved = saves.length;
    face(session, TRACE.at);
    session.talk();
    assert.deepEqual(link.last("dialogue"), {
      t: "dialogue", npc: "hollis", trace: true, lines: TRACE.lines, offer: null,
    });
    assert.deepEqual(session.story, stillOwed);
    assert.equal(saves.length, saved);
  });

  test("his trace points the way: it names the Mistwood", () => {
    assert.ok(TRACE.lines.some((line) => line.includes("Mistwood")));
  });

  test("in the Mistwood he offers a main quest of his own; done, he says what's next and offers nothing", () => {
    const { session, link } = startSession({ saved: { pad: AWAY.region, story: MOVED } });
    const offer = talkTo(session, link, "hollis").offer;
    assert.ok(offer?.kind === "quest");
    const quest = QUESTS[offer.quest]!;
    assert.equal(quest.half, "main");
    assert.deepEqual(quest.when, { done: CHAIN_END });
    session.acceptQuest(offer.quest);
    for (const step of quest.steps) {
      const { task } = step;
      assert.ok(task.kind === "talk", "only talk steps: the Mistwood's own NPCs");
      const lines: readonly string[] | undefined = stopFor(session.story, NPCS[task.to])!.talk
        .find((t) => isDeepStrictEqual(t.when, { quest: offer.quest, step: step.id }))?.lines;
      assert.deepEqual(talkTo(session, link, task.to).lines, lines, `${task.to}'s lines for ${step.id}`);
    }
    assert.equal(session.story.quests[offer.quest]?.step, null);
    const lore = quest.steps.flatMap((s) => (s.reward?.lore ?? []).map((l) => LORE[l]));
    assert.ok(lore.length > 0);
    assert.deepEqual(link.last("questbook").quests.find((q) => q.id === offer.quest)?.lore, lore);
    const after = talkTo(session, link, "hollis");
    assert.equal(after.offer, null);
    assert.deepEqual(after.lines, dialogueOf(AWAY.talk, session.story, session.bag)!.lines);
    assert.deepEqual(after.lines, AWAY.talk.find((t) => isDeepStrictEqual(t.when, { done: offer.quest }))?.lines);
  });
});
