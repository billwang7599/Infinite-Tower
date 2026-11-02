import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { COINS, distXZ, HEADING_WAY, inRect, isSolid, type ItemId, type NpcId } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import { newStory } from "../../../src/core/game/story.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { getLevel } from "../../../src/core/world/index.js";
import { doStep, goTo, linesFor, offeredQuest, startSession, talkTo } from "./helpers.js";

before(() => initPhysics());

const QUARRY = getLevel("old-quarry");
const QUARRY_FOLK: [NpcId, readonly string[]][] = [
  ["foreman", ["foreman-pit"]],
  ["scavenger", ["scavenger-pelts", "scavenger-chanters"]],
];
const QUEST_IDS = QUARRY_FOLK.flatMap(([, chain]) => chain);
const MIN_GAP_TILES = 1.5;

const rewardsOf = (id: string) => QUESTS[id]!.steps.flatMap((s) => Object.keys(s.reward?.items ?? {}) as ItemId[]);

describe("the Old Quarry's folk", () => {
  test("each stands in the quarry on open ground, facing open ground, apart from the pad, the fire and the enemies", () => {
    const [fire] = QUARRY.layout.campfires;
    for (const [npc] of QUARRY_FOLK) {
      const { stops } = NPCS[npc];
      assert.equal(stops.length, 1, npc);
      const { level, at, heading } = stops[0]!, way = HEADING_WAY[heading];
      assert.equal(level, "old-quarry", npc);
      assert.ok(!isSolid(QUARRY.layout, at.x, at.z), npc);
      assert.ok(!isSolid(QUARRY.layout, at.x + way.x, at.z + way.z), `${npc} faces open ground`);
      assert.ok(distXZ(at, QUARRY.spawn) > MIN_GAP_TILES, npc);
      assert.ok(distXZ({ x: at.x + way.x, z: at.z + way.z }, fire!) > MIN_GAP_TILES, `${npc}'s listener is off the fire`);
      for (const { at: spawn } of QUARRY.spawns) assert.ok(distXZ(at, spawn) > MIN_GAP_TILES, npc);
    }
    const [a, b] = QUARRY_FOLK.map(([npc]) => NPCS[npc].stops[0]!.at);
    assert.ok(distXZ(a!, b!) > MIN_GAP_TILES);
  });

  test("each has a word for a new avatar, and offers its first quest", () => {
    const { session, link } = startSession({ saved: { pad: "old-quarry" } });
    for (const [npc, [first]] of QUARRY_FOLK) {
      const said = talkTo(session, link, npc);
      assert.ok(said.lines.length > 0, npc);
      assert.equal(offeredQuest(said.offer), first, npc);
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

  test("the foreman sends you down to the pit's pool, where the Kobold Greatsword stands, before it", () => {
    const [reach, kill] = QUESTS["foreman-pit"]!.steps;
    assert.ok(reach?.task.kind === "reach" && reach.task.level === "old-quarry" && reach.task.area);
    const { area } = reach.task;
    assert.ok(!inRect(area, QUARRY.spawn.x, QUARRY.spawn.z));
    assert.ok(!isSolid(QUARRY.layout, area.x + area.w / 2, area.z + area.h / 2));
    assert.ok(QUARRY.spawns.some((s) => s.enemy === "kobold-greatsword" && inRect(area, s.at.x, s.at.z)));
    assert.deepEqual(kill?.task, { kind: "kill", enemy: "kobold-greatsword", count: 1 });
  });

  test("the scavenger's second quest waits on her first, and nobody else's", () => {
    assert.deepEqual(QUESTS["scavenger-chanters"]!.when, { done: "scavenger-pelts" });
    assert.equal(QUESTS["scavenger-pelts"]!.when, undefined);
    assert.equal(QUESTS["foreman-pit"]!.when, undefined);
  });

  for (const [npc, chain] of QUARRY_FOLK) {
    test(`${npc}'s quests, played through the server: every step done, rewarded and told; then what's next`, () => {
      const p = startSession({ dev: true, saved: { pad: "old-quarry", story: newStory() } });
      for (const id of chain) {
        goTo(p, "old-quarry");
        assert.equal(offeredQuest(talkTo(p.session, p.link, npc).offer), id, `${npc} offers ${id}`);
        p.session.acceptQuest(id);
        for (const step of QUESTS[id]!.steps) doStep(p, id, step);
      }
      const book = p.link.last("questbook").quests;
      for (const id of chain) {
        const lore = QUESTS[id]!.steps.flatMap((s) => (s.reward?.lore ?? []).map((l) => LORE[l]));
        assert.deepEqual(book.find((q) => q.id === id)?.lore, lore, id);
      }
      goTo(p, "old-quarry");
      const after = talkTo(p.session, p.link, npc);
      assert.equal(after.offer, null);
      assert.deepEqual(after.lines, linesFor(p.session.story, npc, { done: chain.at(-1)! }));
    });
  }
});
