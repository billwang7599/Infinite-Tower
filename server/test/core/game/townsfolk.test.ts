import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { COINS, distXZ, HEADING_WAY, isSolid, type ItemId, type NpcId } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import { newStory, type Story } from "../../../src/core/game/story.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getLevel } from "../../../src/core/world/index.js";
import { doStep, goTo, linesFor, offeredQuest, startSession, talkTo } from "./helpers.js";

before(() => initPhysics());

const KINGDOM = getLevel("kingdom");
const TOWNSFOLK: [NpcId, readonly string[]][] = [
  ["captain", ["captain-boars"]],
  ["cook", ["cook-meat"]],
  ["tamsin", ["tamsin-son"]],
  ["chronicler", ["chronicler-roads"]],
  ["priest", []],
];
const QUEST_IDS = TOWNSFOLK.flatMap(([, chain]) => chain);
const MIN_GAP_TILES = 1.5;

const yardDone = (): Story => ({ ...newStory(), quests: { "bram-yard": { step: null, kills: 0 } } });
const rewardsOf = (id: string) => QUESTS[id]!.steps.flatMap((s) => Object.keys(s.reward?.items ?? {}) as ItemId[]);

describe("Highmere's townsfolk", () => {
  test("each stands in Highmere on open ground, facing open ground, apart from everyone else there, whatever the story", () => {
    const inTown = Object.entries(NPCS).flatMap(([id, { stops }]) =>
      stops.filter((s) => s.level === "kingdom").map((s) => ({ id, at: s.at })));
    for (const [npc] of TOWNSFOLK) {
      const { stops } = NPCS[npc];
      assert.equal(stops.length, 1, npc);
      const { level, at, heading } = stops[0]!, way = HEADING_WAY[heading];
      assert.equal(level, "kingdom", npc);
      assert.ok(!isSolid(KINGDOM.layout, at.x, at.z), npc);
      assert.ok(!isSolid(KINGDOM.layout, at.x + way.x, at.z + way.z), `${npc} faces open ground`);
      assert.ok(distXZ(at, KINGDOM.spawn) > MIN_GAP_TILES, npc);
      for (const other of inTown) {
        if (other.id !== npc) assert.ok(distXZ(at, other.at) > MIN_GAP_TILES, `${npc} and ${other.id}`);
      }
    }
  });

  test("each has a word for a new avatar", () => {
    const { session, link } = startSession({ saved: { level: "kingdom" } });
    for (const [npc] of TOWNSFOLK) assert.ok(talkTo(session, link, npc).lines.length > 0, npc);
  });

  test("their quests are side quests that pay in coin and each reveal lore no other quest does", () => {
    for (const id of QUEST_IDS) {
      assert.equal(QUESTS[id]?.half, "side", id);
      assert.ok(rewardsOf(id).some((item) => (COINS as readonly string[]).includes(item)), id);
    }
    const loreOf = (ids: string[]) => ids.flatMap((id) => QUESTS[id]!.steps.flatMap((s) => s.reward?.lore ?? []));
    const mine = loreOf(QUEST_IDS), others = loreOf(Object.keys(QUESTS).filter((id) => !QUEST_IDS.includes(id)));
    assert.equal(new Set(mine).size, mine.length);
    for (const id of mine) assert.ok(!others.includes(id), id);
  });

  test("the captain sends nobody out with empty hands: first Bram's yard, then her quest", () => {
    assert.deepEqual(QUESTS["captain-boars"]!.when, { done: "bram-yard" });
    const fresh = startSession({ saved: { level: "kingdom" } });
    const before = talkTo(fresh.session, fresh.link, "captain");
    assert.equal(before.offer, null);
    assert.deepEqual(before.lines, linesFor(newStory(), "captain", { canStart: "bram-yard" }));
    const armed = startSession({ saved: { level: "kingdom", story: yardDone() } });
    assert.equal(offeredQuest(talkTo(armed.session, armed.link, "captain").offer), "captain-boars");
  });

  test("the others offer theirs to a new avatar", () => {
    const { session, link } = startSession({ saved: { level: "kingdom" } });
    for (const [npc, [first]] of TOWNSFOLK) {
      if (first && QUESTS[first]!.when === undefined) assert.equal(offeredQuest(talkTo(session, link, npc).offer), first);
    }
  });

  for (const [npc, chain] of TOWNSFOLK.filter(([, chain]) => chain.length > 0)) {
    test(`${npc}'s quest, played through the server: every step done, rewarded and told; then what's next`, () => {
      const p = startSession({ dev: true, saved: { level: "kingdom", story: yardDone() } });
      for (const id of chain) {
        goTo(p, "kingdom");
        assert.equal(offeredQuest(talkTo(p.session, p.link, npc).offer), id, `${npc} offers ${id}`);
        p.session.acceptQuest(id);
        for (const step of QUESTS[id]!.steps) doStep(p, id, step);
      }
      const book = p.link.last("questbook").quests;
      for (const id of chain) {
        const lore = QUESTS[id]!.steps.flatMap((s) => (s.reward?.lore ?? []).map((l) => LORE[l]));
        assert.deepEqual(book.find((q) => q.id === id)?.lore, lore, id);
      }
      goTo(p, "kingdom");
      const after = talkTo(p.session, p.link, npc);
      assert.equal(after.offer, null);
      assert.deepEqual(after.lines, linesFor(p.session.story, npc, { done: chain.at(-1)! }));
    });
  }

  test("the priest's word follows the avatar's story: new, armed by Bram, then told of the pads by Hollis", () => {
    const said = (story: Story) => {
      const { session, link } = startSession({ saved: { level: "kingdom", story } });
      return talkTo(session, link, "priest").lines;
    };
    const fresh = said(newStory()), armed = said(yardDone());
    const told = said({ ...yardDone(), flags: ["hollis-to-mistwood"] });
    assert.notDeepEqual(fresh, armed);
    assert.notDeepEqual(armed, told);
    assert.deepEqual(told, linesFor(newStory(), "priest", { flag: "hollis-to-mistwood" }));
  });
});
