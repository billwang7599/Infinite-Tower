import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ENEMY_IDS, ITEM_IDS, NPC_IDS } from "@infinite-tower/shared";
import { QUESTS } from "../../../src/core/content/quests.js";
import type { When } from "../../../src/core/game/story.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { LEVELS } from "../../../src/core/world/index.js";

const IDS = Object.keys(QUESTS);
const FLAGS = Object.values(QUESTS).flatMap((q) => q.steps.flatMap((s) => s.reward?.flags ?? []));
const questOf = (when: When) =>
  "quest" in when ? when.quest : "done" in when ? when.done : "canStart" in when ? when.canStart : null;

function isReal(when: When | undefined): boolean {
  if (when === undefined) return true;
  if ("flag" in when) return FLAGS.includes(when.flag);
  const quest = QUESTS[questOf(when)!];
  return quest !== undefined && (!("step" in when) || quest.steps.some((s) => s.id === when.step));
}

const TALKS = NPC_IDS.flatMap((npc) => NPCS[npc].stops.flatMap((stop) => stop.talk.map((talk) => ({ npc, talk }))));

describe("QUESTS", () => {
  test("each has a title and steps, each with an id of its own, what to do and a hint", () => {
    for (const [id, quest] of Object.entries(QUESTS)) {
      assert.ok(quest.title.trim() && quest.steps.length > 0, id);
      assert.equal(new Set(quest.steps.map((s) => s.id)).size, quest.steps.length, id);
      for (const step of quest.steps) assert.ok(step.id.trim() && step.text.trim() && step.hint.trim(), id);
    }
  });

  test("each reveals a lore entry by the time it's done", () => {
    for (const [id, quest] of Object.entries(QUESTS)) {
      assert.ok(quest.steps.some((s) => (s.reward?.lore ?? []).length > 0), id);
    }
  });

  test("a quest waits only on one listed before it, so a chain can't loop", () => {
    for (const [i, [id, quest]] of Object.entries(QUESTS).entries()) {
      assert.ok(isReal(quest.when), id);
      const on = quest.when && questOf(quest.when);
      if (on) assert.ok(IDS.slice(0, i).includes(on), id);
    }
  });

  test("every task names a real item, enemy, NPC or level, and a count of at least one; rewards real items", () => {
    for (const [id, quest] of Object.entries(QUESTS)) {
      for (const { task, reward } of quest.steps) {
        if ("item" in task) assert.ok(ITEM_IDS.includes(task.item), id);
        if ("enemy" in task) assert.ok(ENEMY_IDS.includes(task.enemy), id);
        if ("to" in task) assert.ok(NPC_IDS.includes(task.to), id);
        if ("level" in task) assert.ok(Object.hasOwn(LEVELS, task.level), id);
        if ("count" in task) assert.ok(Number.isInteger(task.count) && task.count >= 1, id);
        for (const [item, count] of Object.entries(reward?.items ?? {})) {
          assert.ok(ITEM_IDS.includes(item as never) && Number.isInteger(count) && count >= 1, id);
        }
      }
    }
  });
});

describe("what NPCs say about the story", () => {
  test("where they stand and what they say names real quests and steps, and flags a step sets", () => {
    for (const npc of NPC_IDS) for (const stop of NPCS[npc].stops) assert.ok(isReal(stop.when), npc);
    for (const { npc, talk } of TALKS) {
      assert.ok(isReal(talk.when), `${npc}: ${JSON.stringify(talk.when)}`);
      const offered = talk.offer && ("start" in talk.offer ? talk.offer.start : talk.offer.deliver);
      if (offered) assert.ok(Object.hasOwn(QUESTS, offered), `${npc}: ${offered}`);
    }
  });

  test("every quest is offered by someone", () => {
    const offered = TALKS.flatMap(({ talk }) => (talk.offer && "start" in talk.offer ? [talk.offer.start] : []));
    for (const id of IDS) assert.ok(offered.includes(id), id);
  });

  test("a talk step's NPC has lines for it, and a deliver step's asks for the handover", () => {
    for (const [id, quest] of Object.entries(QUESTS)) {
      for (const { id: step, task } of quest.steps) {
        const theirs = TALKS.filter(({ npc }) => "to" in task && npc === task.to);
        if (task.kind === "talk") {
          assert.ok(theirs.some(({ talk }) => talk.when && "step" in talk.when && talk.when.quest === id
            && talk.when.step === step), `${id}: ${step}`);
        }
        if (task.kind === "deliver") {
          assert.ok(theirs.some(({ talk }) => talk.offer && "deliver" in talk.offer && talk.offer.deliver === id), id);
        }
      }
    }
  });
});
