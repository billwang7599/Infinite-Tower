import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { NpcId } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import { newStory } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { START_REGION } from "../../../src/core/world/index.js";
import { doStep, linesFor, offeredQuest, startSession, talkTo } from "./helpers.js";

before(() => initPhysics());

const NATIVES: [NpcId, readonly string[]][] = [
  ["corwin", ["corwin-blind", "corwin-count"]],
  ["ilse", ["ilse-weights", "ilse-snapped"]],
];

describe("the Grass Field's and the Mistwood's natives", () => {
  test("each stands past the Hollow, and offers even a new character their first quest", () => {
    for (const [npc, [first]] of NATIVES) {
      const level = stopFor(newStory(), NPCS[npc])!.region;
      assert.notEqual(level, START_REGION, npc);
      const { session, link } = startSession({ saved: { pad: level } });
      assert.equal(offeredQuest(talkTo(session, link, npc).offer), first, npc);
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
      const level = stopFor(newStory(), NPCS[npc])!.region;
      const p = startSession({ cheats: true, saved: { pad: level } });
      for (const id of chain) {
        const offer = talkTo(p.session, p.link, npc).offer;
        assert.ok(offer?.kind === "quest" && offer.quest === id, `${npc} offers ${id}`);
        p.session.acceptQuest(id);
        for (const step of QUESTS[id]!.steps) doStep(p, id, step);
      }
      const book = p.link.last("questbook").quests;
      for (const id of chain) {
        const lore = QUESTS[id]!.steps.flatMap((s) => (s.reward?.lore ?? []).map((l) => LORE[l]));
        assert.deepEqual(book.find((q) => q.id === id)?.lore, lore, id);
      }
      const after = talkTo(p.session, p.link, npc);
      assert.equal(after.offer, null);
      assert.deepEqual(after.lines, linesFor(p.session.story, npc, { done: chain.at(-1)! }));
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
