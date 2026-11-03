import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { COINS, distXZ, HEADING_WAY, isSolid, type ItemId, type NpcId } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import { holds, newStory, type Story } from "../../../src/core/game/story.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getRegion, WORLD } from "../../../src/core/world/index.js";
import { doStep, goTo, regionOf, linesFor, offeredQuest, startIn, talkTo } from "./helpers.js";

before(() => initPhysics());

const WARDS = ["kingdom", "market-ward"];
const TOWNSFOLK: [NpcId, readonly string[]][] = [
  ["captain", ["captain-boars"]],
  ["cook", ["cook-meat"]],
  ["tamsin", ["tamsin-son"]],
  ["chronicler", ["chronicler-roads"]],
  ["priest", []],
  ["king", []],
  ["innkeeper", []],
];
const QUEST_IDS = TOWNSFOLK.flatMap(([, chain]) => chain);
const MIN_GAP_TILES = 1.5;
const SIGHT_STEP_TILES = 0.1;

const yardDone = (): Story => ({ ...newStory(), quests: { "bram-yard": { step: null, kills: 0 } } });
const rewardsOf = (id: string) => QUESTS[id]!.steps.flatMap((s) => Object.keys(s.reward?.items ?? {}) as ItemId[]);

describe("Highmere's townsfolk", () => {
  test("each stands in one of Highmere's wards on open ground, facing open ground, apart from everyone else there, whatever the story", () => {
    const placed = Object.entries(NPCS).flatMap(([id, { stops }]) => stops.map((s) => ({ id, region: s.region, at: s.at })));
    for (const [npc] of TOWNSFOLK) {
      const { stops } = NPCS[npc];
      assert.equal(stops.length, 1, npc);
      const { region, at, heading } = stops[0]!, way = HEADING_WAY[heading], { spawn } = getRegion(region);
      const { layout } = WORLD;
      assert.ok(WARDS.includes(region), npc);
      assert.ok(!isSolid(layout, at.x, at.z), npc);
      assert.ok(!isSolid(layout, at.x + way.x, at.z + way.z), `${npc} faces open ground`);
      assert.ok(distXZ(at, spawn) > MIN_GAP_TILES, npc);
      for (const other of placed.filter((o) => o.region === region && o.id !== npc)) {
        assert.ok(distXZ(at, other.at) > MIN_GAP_TILES, `${npc} and ${other.id}`);
      }
    }
  });

  test("each has a word for a new avatar", () => {
    for (const [npc] of TOWNSFOLK) {
      const { session, link } = startIn(regionOf(newStory(), npc));
      assert.ok(talkTo(session, link, npc).lines.length > 0, npc);
    }
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

  const AFTER_THE_YARD: [NpcId, string][] = [["captain", "captain-boars"], ["chronicler", "chronicler-roads"]];
  for (const [npc, quest] of AFTER_THE_YARD) {
    test(`${npc} sends a new avatar to Bram's yard first, and offers ${quest} only once it's done`, () => {
      assert.deepEqual(QUESTS[quest]!.when, { done: "bram-yard" });
      const fresh = startIn(regionOf(newStory(), npc));
      const before = talkTo(fresh.session, fresh.link, npc);
      assert.equal(before.offer, null);
      assert.deepEqual(before.lines, linesFor(newStory(), npc, { canStart: "bram-yard" }));
      const inYard: Story = { ...newStory(), quests: { "bram-yard": { step: QUESTS["bram-yard"]!.steps[0]!.id, kills: 0 } } };
      const training = startIn(regionOf(inYard, npc), { saved: { story: inYard } });
      assert.equal(talkTo(training.session, training.link, npc).offer, null);
      const armed = startIn(regionOf(newStory(), npc), { saved: { story: yardDone() } });
      assert.equal(offeredQuest(talkTo(armed.session, armed.link, npc).offer), quest);
    });
  }

  test("a new avatar wakes to Aldric alone: nobody else stands in sight of the platform", () => {
    const { spawn } = getRegion("kingdom"), { layout } = WORLD;
    const inSight = (to: { x: number; z: number }) => {
      const samples = Math.ceil(distXZ(spawn, to) / SIGHT_STEP_TILES);
      for (let i = 1; i < samples; i++) {
        const t = i / samples;
        if (isSolid(layout, spawn.x + (to.x - spawn.x) * t, spawn.z + (to.z - spawn.z) * t)) return false;
      }
      return true;
    };
    const seen = Object.entries(NPCS).flatMap(([id, { stops }]) =>
      stops.filter((s) => s.region === "kingdom" && holds(s.when, newStory()) && inSight(s.at)).map(() => id));
    assert.deepEqual(seen, ["herald"]);
  });

  test("the others offer theirs to a new avatar", () => {
    for (const [npc, [first]] of TOWNSFOLK) {
      if (!first || QUESTS[first]!.when !== undefined) continue;
      const { session, link } = startIn(regionOf(newStory(), npc));
      assert.equal(offeredQuest(talkTo(session, link, npc).offer), first);
    }
  });

  for (const [npc, chain] of TOWNSFOLK.filter(([, chain]) => chain.length > 0)) {
    test(`${npc}'s quest, played through the server: every step done, rewarded and told; then what's next`, () => {
      const home = regionOf(newStory(), npc);
      const p = startIn(home, { dev: true, saved: { story: yardDone() } });
      for (const id of chain) {
        goTo(p, home);
        assert.equal(offeredQuest(talkTo(p.session, p.link, npc).offer), id, `${npc} offers ${id}`);
        p.session.acceptQuest(id);
        for (const step of QUESTS[id]!.steps) doStep(p, id, step);
      }
      const book = p.link.last("questbook").quests;
      for (const id of chain) {
        const lore = QUESTS[id]!.steps.flatMap((s) => (s.reward?.lore ?? []).map((l) => LORE[l]));
        assert.deepEqual(book.find((q) => q.id === id)?.lore, lore, id);
      }
      goTo(p, home);
      const after = talkTo(p.session, p.link, npc);
      assert.equal(after.offer, null);
      assert.deepEqual(after.lines, linesFor(p.session.story, npc, { done: chain.at(-1)! }));
    });
  }

  test("the priest's word follows the avatar's story: new, armed by Bram, then told of the pads by Hollis", () => {
    const said = (story: Story) => {
      const { session, link } = startIn(regionOf(story, "priest"), { saved: { story } });
      return talkTo(session, link, "priest").lines;
    };
    const fresh = said(newStory()), armed = said(yardDone());
    const told = said({ ...yardDone(), flags: ["hollis-to-mistwood"] });
    assert.notDeepEqual(fresh, armed);
    assert.notDeepEqual(armed, told);
    assert.deepEqual(told, linesFor(newStory(), "priest", { flag: "hollis-to-mistwood" }));
  });
});
