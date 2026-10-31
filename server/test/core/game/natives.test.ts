import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import type { NpcId } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS, type QuestStep } from "../../../src/core/content/quests.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory, type When } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { START_LEVEL } from "../../../src/core/world/index.js";
import type { FakeLink } from "../../fixtures/fakes.js";
import { bagWith, startSession, talkTo, tick, winFight } from "./helpers.js";

before(() => initPhysics());

const NATIVES: [NpcId, readonly string[]][] = [
  ["corwin", ["corwin-blind", "corwin-count"]],
  ["ilse", ["ilse-weights", "ilse-snapped"]],
];

const linesFor = (session: GameSession, npc: NpcId, when: When) =>
  stopFor(session.story, NPCS[npc])!.talk.find((t) => isDeepStrictEqual(t.when, when))?.lines;

function doStep(session: GameSession, link: FakeLink, id: string, step: QuestStep): void {
  const { task } = step;
  switch (task.kind) {
    case "gather":
      session.bag = bagWith({ [task.item]: task.count - 1 });
      tick(session);
      assert.equal(session.story.quests[id]!.step, step.id, "one short");
      session.bag = bagWith({ [task.item]: task.count });
      tick(session);
      break;
    case "deliver":
      assert.equal(talkTo(session, link, task.to).offer?.kind, "deliver");
      session.deliver(id);
      break;
    case "reach":
      assert.equal(session.overworld.level.layout.id, task.level);
      assert.ok(task.area, "a place on the level");
      tick(session);
      assert.equal(session.story.quests[id]!.step, step.id, "not there yet");
      session.overworld.place(session.me, { x: task.area.x + task.area.w / 2, z: task.area.z + task.area.h / 2 });
      tick(session);
      break;
    case "kill":
      for (let i = 0; i < task.count; i++) winFight(session, task.enemy);
      break;
    case "talk": {
      const lines = linesFor(session, task.to, { quest: id, step: step.id });
      assert.ok(lines, `${task.to} has lines for it`);
      assert.deepEqual(talkTo(session, link, task.to).lines, lines);
      break;
    }
  }
  const quest = QUESTS[id]!, next = quest.steps[quest.steps.indexOf(step) + 1] ?? null;
  assert.equal(session.story.quests[id]!.step, next?.id ?? null, `${id}: ${step.id} done`);
  assert.deepEqual(link.last("questbook").news.at(-1), {
    kind: "advanced", quest: quest.title, next: next?.text ?? null, gained: step.reward?.items ?? {}, dropped: {},
    lore: (step.reward?.lore ?? []).map((l) => LORE[l].title),
  });
}

describe("the Grass Field's and the Mistwood's natives", () => {
  test("each stands past the Hollow, and offers even a new character their first quest", () => {
    for (const [npc, [first]] of NATIVES) {
      const level = stopFor(newStory(), NPCS[npc])!.level;
      assert.notEqual(level, START_LEVEL, npc);
      const { session, link } = startSession({ saved: { level } });
      assert.equal(talkTo(session, link, npc).offer?.quest, first, npc);
    }
  });

  test("their quests are side quests, each a step on from the last, waiting on nothing else", () => {
    for (const [npc, chain] of NATIVES) {
      for (const [i, id] of chain.entries()) {
        assert.equal(QUESTS[id]?.half, "side", id);
        assert.deepEqual(QUESTS[id]!.when, i === 0 ? undefined : { done: chain[i - 1] }, `${npc}: ${id}`);
      }
    }
  });

  for (const [npc, chain] of NATIVES) {
    test(`${npc}'s quests, played through the server: every step done, rewarded and told; then what's next`, () => {
      const level = stopFor(newStory(), NPCS[npc])!.level;
      const { session, link } = startSession({ dev: true, saved: { level } });
      for (const id of chain) {
        const offer = talkTo(session, link, npc).offer;
        assert.ok(offer?.kind === "quest" && offer.quest === id, `${npc} offers ${id}`);
        session.acceptQuest(id);
        for (const step of QUESTS[id]!.steps) doStep(session, link, id, step);
      }
      const book = link.last("questbook").quests;
      for (const id of chain) {
        const lore = QUESTS[id]!.steps.flatMap((s) => (s.reward?.lore ?? []).map((l) => LORE[l]));
        assert.deepEqual(book.find((q) => q.id === id)?.lore, lore, id);
      }
      const after = talkTo(session, link, npc);
      assert.equal(after.offer, null);
      assert.deepEqual(after.lines, linesFor(session, npc, { done: chain.at(-1)! }));
    });
  }

  test("each reveals lore of its own, that no other quest does", () => {
    const theirs = new Set(NATIVES.flatMap(([, chain]) => chain));
    const loreOf = (ids: string[]) => ids.flatMap((id) => QUESTS[id]!.steps.flatMap((s) => s.reward?.lore ?? []));
    const mine = loreOf([...theirs]), others = loreOf(Object.keys(QUESTS).filter((id) => !theirs.has(id)));
    assert.equal(new Set(mine).size, mine.length);
    for (const id of mine) assert.ok(!others.includes(id), id);
  });
});
