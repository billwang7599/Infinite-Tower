import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  emptyBag, HEADING_WAY, INTERACT_LOOK_RAD, INTERACT_RANGE_M, packFor, type Bag, type Heading,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import type { QuestDef, Quests, QuestStep, Task } from "../../../src/core/content/quests.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { newStory, type Story } from "../../../src/core/game/story.js";
import { dialogueOf, placedOn, stopFor } from "../../../src/core/game/talk.js";
import { NPCS, type Npc, type Stop } from "../../../src/core/npcs/index.js";
import { INTERACT_LAG_SLACK_M, INTERACT_LOOK_SLACK_RAD } from "../../../src/core/overworld/interact.js";
import { bagWith, startSession, tick } from "./helpers.js";

before(() => initPhysics());

const NPC = stopFor(newStory(), NPCS.hollis)!;
const start = (opts: Parameters<typeof startSession>[0] = {}) =>
  startSession({ ...opts, saved: { pad: NPC.region, ...opts.saved } });
const REACH_TILES = INTERACT_RANGE_M + INTERACT_LAG_SLACK_M;
const carrying = (bag: Bag) => ({ bag, pack: packFor(null), quiver: packFor(null) });
const LOOK_RAD = INTERACT_LOOK_RAD + INTERACT_LOOK_SLACK_RAD;

function standBy(session: GameSession, awayTiles: number, heading: Heading = "west", offRad = 0): void {
  const way = HEADING_WAY[heading], toNpcRad = Math.atan2(way.x, way.z) + offRad;
  session.overworld.place(session.me, {
    x: NPC.at.x - Math.sin(toNpcRad) * awayTiles, z: NPC.at.z - Math.cos(toNpcRad) * awayTiles,
  });
  session.overworld.playerData(session.me).heading = heading;
}

const step = (id: string, task: Task): QuestStep => ({ id, task, text: `${id} text`, hint: `${id} hint` });
const quest = (steps: QuestStep[], extra: Partial<QuestDef> = {}): QuestDef =>
  ({ title: "A quest", half: "main", steps, ...extra });
const on = (id: string, stepId: string | null): Story =>
  ({ ...newStory(), quests: { [id]: { step: stepId, kills: 0 } } });

describe("talking to an NPC", () => {
  test("it's sent with the world, where its stop is for this player", () => {
    const shown = start().link.last("world").world.npcs.filter((n) => n.npc === "hollis");
    assert.deepEqual(shown, [{ npc: "hollis", at: NPC.at, heading: NPC.heading }]);
  });

  test("in reach (with the lag slack) and faced, the server sends who it is and what it says", () => {
    const { session, link } = start();
    standBy(session, REACH_TILES - 0.1);
    session.talk();
    assert.deepEqual(link.last("dialogue").npc, "hollis");
    assert.deepEqual(link.last("dialogue").lines, dialogueOf(NPC.talk, newStory(), carrying(emptyBag()))!.lines);
  });

  test("out of reach, nothing", () => {
    const { session, link } = start();
    standBy(session, REACH_TILES + 0.1);
    session.talk();
    assert.equal(link.all("dialogue").length, 0);
  });

  test("only looked at: not behind them, nor further round than the look (plus the lag slack)", () => {
    const { session, link } = start();
    for (const offRad of [Math.PI, LOOK_RAD + 0.02, -(LOOK_RAD + 0.02)]) {
      standBy(session, 1, "west", offRad);
      session.talk();
    }
    assert.equal(link.all("dialogue").length, 0);
    standBy(session, 1, "west", LOOK_RAD - 0.02);
    session.talk();
    assert.equal(link.all("dialogue").length, 1);
  });

  test("they face the way they last walked", () => {
    const { session, link } = start();
    standBy(session, 1, "north");
    session.input(session.overworld.playerData(session.me).lastSeq + 1, 0, -1);
    tick(session);
    session.talk();
    assert.equal(link.all("dialogue").length, 0, "turned their back on it");
  });

  test("not mid-fight", () => {
    const { session, link } = start({ dev: true });
    standBy(session, 1);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.talk();
    assert.equal(link.all("dialogue").length, 0);
  });

  test("with no quest step to it, it changes nothing: no save, and only the lines are sent", () => {
    const { session, link, saves } = start();
    standBy(session, 1);
    const before = { sent: link.sent.length, saves: saves.length, vitals: session.vitals, gear: session.gear };
    session.talk();
    assert.deepEqual(link.sent.slice(before.sent).map((m) => m.t), ["dialogue"]);
    assert.equal(saves.length, before.saves);
    assert.equal(session.vitals, before.vitals);
    assert.equal(session.gear, before.gear);
  });
});

describe("where an NPC stands, and what it says", () => {
  const QUESTS: Quests = {
    q: quest([
      step("find", { kind: "gather", item: "boar-hide", count: 2 }),
      step("hides", { kind: "deliver", item: "boar-hide", count: 2, to: "hollis" }),
    ], { title: "Q" }),
  };
  const fire: Stop = {
    region: "grass-field", at: { x: 0, z: 0 }, heading: "west",
    talk: [
      { when: { quest: "q", step: "hides" }, lines: ["hand them over"], offer: { deliver: "q" } },
      { when: { canStart: "q" }, lines: ["will you?"], offer: { start: "q" } },
      { lines: ["hello"], offer: { deliver: "q" } },
    ],
    trace: { at: { x: 1, z: 0 }, lines: ["a bedroll"] },
  };
  const woods: Stop = {
    when: { flag: "moved" }, region: "mistwood", at: { x: 1, z: 1 }, heading: "east", talk: [{ lines: ["here"] }],
    trace: { at: { x: 2, z: 1 }, lines: ["a note"] },
  };
  const NPC: Npc = { stops: [woods, fire] };
  const moved: Story = { ...newStory(), flags: ["moved"] };
  const enough = carrying(bagWith({ "boar-hide": 3 }));

  test("an NPC stands at its first stop whose condition holds, for this player; with none, nowhere", () => {
    assert.equal(stopFor(newStory(), NPC, QUESTS), fire);
    assert.equal(stopFor(moved, NPC, QUESTS), woods);
    assert.equal(stopFor(newStory(), { stops: [woods] }, QUESTS), null);
  });

  test("each NPC at its stop for this player, with traces of the stops it has moved on from", () => {
    const placed = (story: Story, npc = NPC) => placedOn(story, { hollis: npc }, QUESTS);
    assert.deepEqual(placed(newStory()), { npcs: [{ npc: "hollis", stop: fire }], traces: [] });
    assert.deepEqual(placed(moved), { npcs: [{ npc: "hollis", stop: woods }], traces: [{ npc: "hollis", trace: fire.trace }] });
    assert.deepEqual(placed(newStory(), { stops: [woods] }), { npcs: [], traces: [] }, "nowhere");
  });

  test("it says the first talk at its stop whose condition holds; with none, nothing", () => {
    assert.deepEqual(dialogueOf(woods.talk, moved, enough, QUESTS)?.lines, ["here"]);
    assert.deepEqual(dialogueOf(fire.talk, newStory(), enough, QUESTS)?.lines, ["will you?"]);
    assert.deepEqual(dialogueOf(fire.talk, on("q", "hides"), enough, QUESTS)?.lines, ["hand them over"]);
    assert.deepEqual(dialogueOf(fire.talk, on("q", "find"), enough, QUESTS)?.lines, ["hello"]);
    assert.equal(dialogueOf(fire.talk.slice(0, 1), newStory(), enough, QUESTS), null);
  });

  test("a quest is offered with its title and first step, while it can start", () => {
    assert.deepEqual(dialogueOf(fire.talk, newStory(), carrying(emptyBag()), QUESTS)?.offer, {
      kind: "quest", quest: "q", title: "Q", step: "find text",
    });
  });

  test("a handover is asked for only on that deliver step, with enough in the bag", () => {
    assert.deepEqual(dialogueOf(fire.talk, on("q", "hides"), enough, QUESTS)?.offer, {
      kind: "deliver", quest: "q", item: "boar-hide", count: 2,
    });
    assert.equal(dialogueOf(fire.talk, on("q", "hides"), carrying(bagWith({ "boar-hide": 1 })), QUESTS)?.offer, null);
    assert.equal(dialogueOf(fire.talk, on("q", "find"), enough, QUESTS)?.offer, null, "on another step");
    assert.equal(dialogueOf(fire.talk, on("q", null), enough, QUESTS)?.offer, null, "done");
  });
});
