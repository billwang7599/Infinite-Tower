import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  bagCounts, Health, HEADING_WAY, IDLE_INPUT, type EnemyId, type Heading, type NpcId,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { LORE } from "../../../src/core/content/lore.js";
import { QUESTS } from "../../../src/core/content/quests.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory, type Story } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { START_LEVEL } from "../../../src/core/world/index.js";
import type { FakeLink } from "../../fixtures/fakes.js";
import { bagWith, startSession, tick } from "./helpers.js";

before(() => initPhysics());

const CHAIN = ["maren-waking", "tobin-smoke", "maren-road"] as const;
const BACK_TO: Record<Heading, Heading> = { north: "south", south: "north", east: "west", west: "east" };

function face(session: GameSession, npc: NpcId): void {
  const stop = stopFor(session.story, NPCS[npc])!;
  assert.equal(session.overworld.level.layout.id, stop.level, `${npc} stands on this level`);
  const way = HEADING_WAY[stop.heading];
  session.overworld.place(session.me, { x: stop.at.x + way.x, z: stop.at.z + way.z });
  session.overworld.playerData(session.me).heading = BACK_TO[stop.heading];
}

function talk(session: GameSession, link: FakeLink, npc: NpcId) {
  face(session, npc);
  session.talk();
  const said = link.last("dialogue");
  assert.equal(said.npc, npc);
  return said;
}

function win(session: GameSession, enemy: EnemyId): void {
  session.cheat({ kind: "encounter", enemy });
  const fight = session.battle!.room.fight;
  fight.world.require(fight.enemies[0]!, Health).hp = 0;
  for (let i = 0; i < 5 && !session.battle!.over; i++) {
    const step = fight.steps + 1;
    session.battleInput(step, [{ step, ...IDLE_INPUT }]);
    session.tick();
  }
  session.leaveBattle();
}

const done = (...ids: string[]): Story =>
  ({ ...newStory(), quests: Object.fromEntries(ids.map((id) => [id, { step: null, kills: 0 }])) });

describe("the Waking Hollow's first quests", () => {
  test("are the main quest, each a step on from the last", () => {
    for (const [i, id] of CHAIN.entries()) {
      assert.equal(QUESTS[id]?.half, "main", id);
      if (i > 0) assert.deepEqual(QUESTS[id]!.when, { done: CHAIN[i - 1] }, id);
    }
  });

  test("a new character wakes there, and the native by the fire offers the first", () => {
    const { session, link } = startSession();
    assert.equal(session.overworld.level.layout.id, START_LEVEL);
    assert.deepEqual(talk(session, link, "maren").offer?.quest, CHAIN[0]);
  });

  test("talk, a first boar fight, meat for the rack, then on to Hollis, who offers his own first quest", () => {
    const { session, link, saves } = startSession({ dev: true });
    session.acceptQuest(talk(session, link, "maren").offer!.quest);
    win(session, "wild-boar");
    talk(session, link, "maren");
    assert.equal(session.story.quests["maren-waking"]?.step, null);

    session.acceptQuest(talk(session, link, "tobin").offer!.quest);
    const [gather, bring] = QUESTS["tobin-smoke"]!.steps;
    assert.ok(gather?.task.kind === "gather" && bring?.task.kind === "deliver");
    session.bag = bagWith({ [gather.task.item]: gather.task.count });
    tick(session);
    assert.deepEqual(talk(session, link, "tobin").offer?.kind, "deliver");
    session.deliver("tobin-smoke");
    assert.deepEqual(bagCounts(session.bag), bring.reward?.items ?? {});

    session.acceptQuest(talk(session, link, "maren").offer!.quest);
    assert.equal(session.story.quests["maren-road"]?.step, QUESTS["maren-road"]!.steps[0]!.id);

    const there = startSession({ saved: { ...saves.at(-1)!, level: stopFor(session.story, NPCS.hollis)!.level } });
    const hollis = talk(there.session, there.link, "hollis");
    assert.deepEqual(hollis.offer?.quest, "hollis-hides");
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
      const offer = talk(session, link, npc).offer;
      assert.ok(offer?.kind === "quest", npc);
      assert.equal(QUESTS[offer.quest]?.half, "side", npc);
    }
  });
});
