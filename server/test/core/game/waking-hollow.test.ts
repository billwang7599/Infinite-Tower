import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { bagCounts } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import { newStory, type Story } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { bagWith, HOLLOW, offeredQuest, startSession, talkTo, tick, winFight } from "./helpers.js";

before(() => initPhysics());

const CHAIN = ["maren-waking", "tobin-smoke", "maren-road"] as const;
const done = (...ids: string[]): Story =>
  ({ ...newStory(), quests: Object.fromEntries(ids.map((id) => [id, { step: null, kills: 0 }])) });

describe("the Waking Hollow's first quests", () => {
  test("are the main quest, each a step on from the last", () => {
    for (const [i, id] of CHAIN.entries()) {
      assert.equal(QUESTS[id]?.half, "main", id);
      if (i > 0) assert.deepEqual(QUESTS[id]!.when, { done: CHAIN[i - 1] }, id);
    }
  });

  test("the native by its fire offers the first", () => {
    const { session, link } = startSession();
    assert.equal(session.region, HOLLOW);
    assert.deepEqual(offeredQuest(talkTo(session, link, "maren").offer), CHAIN[0]);
  });

  test("talk, a first boar fight, meat for the rack, then on to Hollis, who offers his own first quest", () => {
    const { session, link, saves } = startSession({ cheats: true });
    session.acceptQuest(offeredQuest(talkTo(session, link, "maren").offer)!);
    winFight(session, "wild-boar");
    talkTo(session, link, "maren");
    assert.equal(session.story.quests["maren-waking"]?.step, null);

    session.acceptQuest(offeredQuest(talkTo(session, link, "tobin").offer)!);
    const [gather, bring] = QUESTS["tobin-smoke"]!.steps;
    assert.ok(gather?.task.kind === "gather" && bring?.task.kind === "deliver");
    session.bag = bagWith({ [gather.task.item]: gather.task.count });
    tick(session);
    assert.deepEqual(talkTo(session, link, "tobin").offer?.kind, "deliver");
    session.deliver("tobin-smoke");
    assert.deepEqual(bagCounts(session.bag), bring.reward?.items ?? {});

    session.acceptQuest(offeredQuest(talkTo(session, link, "maren").offer)!);
    assert.equal(session.story.quests["maren-road"]?.step, QUESTS["maren-road"]!.steps[0]!.id);

    const there = startSession({ saved: { ...saves.at(-1)!, pad: stopFor(session.story, NPCS.hollis)!.region } });
    const hollis = talkTo(there.session, there.link, "hollis");
    assert.deepEqual(offeredQuest(hollis.offer), "hollis-hides");
    for (const id of CHAIN) assert.equal(there.session.story.quests[id]?.step, null, id);
    const book = there.link.last("questbook").quests;
    for (const id of CHAIN) assert.ok(book.find((q) => q.id === id)!.lore.length > 0, id);
  });

  test("each of them reveals a lore entry of its own", () => {
    const lore = CHAIN.flatMap((id) => QUESTS[id]!.steps.flatMap((s) => s.reward?.lore ?? []));
    assert.equal(new Set(lore).size, lore.length);
    for (const id of lore) assert.ok(LORE[id].text.length > 0, id);
  });

  test("once they're done, both natives have a side quest to offer", () => {
    const { session, link } = startSession({ saved: { story: done(...CHAIN) } });
    for (const npc of ["maren", "tobin"] as const) {
      const offer = talkTo(session, link, npc).offer;
      assert.ok(offer?.kind === "quest", npc);
      assert.equal(QUESTS[offer.quest]?.half, "side", npc);
    }
  });
});
