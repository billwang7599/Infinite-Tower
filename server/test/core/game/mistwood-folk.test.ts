import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { COINS, distXZ, HEADING_WAY, inRect, isSolid, tileAt, type ItemId, type NpcId } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import { newStory, type Story } from "../../../src/core/game/story.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getLevel } from "../../../src/core/world/index.js";
import { doStep, goTo, levelOf, linesFor, offeredQuest, startIn, startSession, talkTo } from "./helpers.js";

before(() => initPhysics());

const MISTWOOD = getLevel("mistwood");
const MISTWOOD_FOLK: [NpcId, readonly string[]][] = [
  ["herbalist", ["herbalist-fangs", "herbalist-mist"]],
  ["burner", ["burner-rook"]],
];
const QUEST_IDS = MISTWOOD_FOLK.flatMap(([, chain]) => chain);
const MIN_GAP_TILES = 1.5;

const sonFound = (): Story => ({ ...newStory(), quests: { "tamsin-son": { step: null, kills: 0 } } });
const rewardsOf = (id: string) => QUESTS[id]!.steps.flatMap((s) => Object.keys(s.reward?.items ?? {}) as ItemId[]);

describe("the Mistwood's folk", () => {
  test("each stands in the Mistwood on open ground, facing open ground, apart from everyone and every spawn", () => {
    const [fire] = MISTWOOD.layout.campfires;
    const others = Object.entries(NPCS).flatMap(([id, { stops }]) =>
      stops.filter((s) => s.level === "mistwood").map((s) => ({ id, at: s.at })));
    const spawns = MISTWOOD.spawns.flatMap(({ at }) => [at, { x: -at.x, z: at.z }]);
    for (const [npc] of MISTWOOD_FOLK) {
      const { stops } = NPCS[npc];
      assert.equal(stops.length, 1, npc);
      const { level, at, heading } = stops[0]!, way = HEADING_WAY[heading];
      assert.equal(level, "mistwood", npc);
      assert.ok(!isSolid(MISTWOOD.layout, at.x, at.z), npc);
      assert.ok(!isSolid(MISTWOOD.layout, at.x + way.x, at.z + way.z), `${npc} faces open ground`);
      assert.ok(distXZ(at, MISTWOOD.spawn) > MIN_GAP_TILES, npc);
      assert.ok(distXZ(at, fire!) > MIN_GAP_TILES, npc);
      for (const spawn of spawns) assert.ok(distXZ(at, spawn) > MIN_GAP_TILES, npc);
      for (const other of others) {
        if (other.id !== npc) assert.ok(distXZ(at, other.at) > MIN_GAP_TILES, `${npc} and ${other.id}`);
      }
    }
  });

  test("each has a word for a new avatar, and the herbalist offers her first quest", () => {
    const { session, link } = startSession({ saved: { level: "mistwood" } });
    for (const [npc] of MISTWOOD_FOLK) assert.ok(talkTo(session, link, npc).lines.length > 0, npc);
    assert.equal(offeredQuest(talkTo(session, link, "herbalist").offer), "herbalist-fangs");
  });

  test("their quests are side quests that pay in coin and each reveal lore no other quest does", () => {
    for (const id of QUEST_IDS) {
      assert.equal(QUESTS[id]?.half, "side", id);
      assert.ok(rewardsOf(id).some((item) => (COINS as readonly string[]).includes(item)), id);
    }
    const loreOf = (ids: string[]) => ids.flatMap((id) => QUESTS[id]!.steps.flatMap((s) => s.reward?.lore ?? []));
    const mine = loreOf(QUEST_IDS), others = loreOf(Object.keys(QUESTS).filter((id) => !QUEST_IDS.includes(id)));
    assert.equal(mine.length, QUEST_IDS.length);
    assert.equal(new Set(mine).size, mine.length);
    for (const id of mine) assert.ok(!others.includes(id), id);
  });

  test("the herbalist's second quest waits on her first, and sends you out onto the lake's island", () => {
    assert.equal(QUESTS["herbalist-fangs"]!.when, undefined);
    assert.deepEqual(QUESTS["herbalist-mist"]!.when, { done: "herbalist-fangs" });
    const [reach] = QUESTS["herbalist-mist"]!.steps;
    assert.ok(reach?.task.kind === "reach" && reach.task.level === "mistwood" && reach.task.area);
    const { area } = reach.task;
    assert.ok(!inRect(area, MISTWOOD.spawn.x, MISTWOOD.spawn.z));
    assert.ok(!isSolid(MISTWOOD.layout, area.x + area.w / 2, area.z + area.h / 2));
    assert.equal(tileAt(MISTWOOD.layout, area.x + area.w / 2, area.z + area.h + 0.5), "water", "the lake lies past it");
  });

  test("the burner has news of Tamsin's son only for someone who has asked after him", () => {
    assert.deepEqual(QUESTS["burner-rook"]!.when, { done: "tamsin-son" });
    const fresh = startSession({ saved: { level: "mistwood" } });
    assert.equal(talkTo(fresh.session, fresh.link, "burner").offer, null);
    const asked = startSession({ saved: { level: "mistwood", story: sonFound() } });
    assert.equal(offeredQuest(talkTo(asked.session, asked.link, "burner").offer), "burner-rook");
    const last = QUESTS["burner-rook"]!.steps.at(-1)!;
    assert.deepEqual(last.task, { kind: "talk", to: "tamsin" });
  });

  for (const [npc, chain] of MISTWOOD_FOLK) {
    test(`${npc}'s quests, played through the server: every step done, rewarded and told; then what's next`, () => {
      const p = startSession({ dev: true, saved: { level: "mistwood", story: sonFound() } });
      for (const id of chain) {
        goTo(p, "mistwood");
        assert.equal(offeredQuest(talkTo(p.session, p.link, npc).offer), id, `${npc} offers ${id}`);
        p.session.acceptQuest(id);
        for (const step of QUESTS[id]!.steps) doStep(p, id, step);
      }
      const book = p.link.last("questbook").quests;
      for (const id of chain) {
        const lore = QUESTS[id]!.steps.flatMap((s) => (s.reward?.lore ?? []).map((l) => LORE[l]));
        assert.deepEqual(book.find((q) => q.id === id)?.lore, lore, id);
      }
      goTo(p, "mistwood");
      const after = talkTo(p.session, p.link, npc);
      assert.equal(after.offer, null);
      assert.deepEqual(after.lines, linesFor(p.session.story, npc, { done: chain.at(-1)! }));
    });
  }

  test("once word has reached her, Tamsin speaks of where Rook went", () => {
    const story: Story = {
      ...sonFound(), quests: { ...sonFound().quests, "burner-rook": { step: null, kills: 0 } },
    };
    const { session, link } = startIn(levelOf(story, "tamsin"), { saved: { story } });
    assert.deepEqual(talkTo(session, link, "tamsin").lines, linesFor(story, "tamsin", { done: "burner-rook" }));
  });
});
