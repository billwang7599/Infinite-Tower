import assert from "node:assert/strict";
import { before, describe, test, type TestContext } from "node:test";
import {
  COINS, distXZ, FIXED_DT, HEADING_WAY, inTallGrass, isSolid, regionAt, tileAt, type EnemyId, type Rect, type Vec2,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { QUEST_ORDER, QUESTS } from "../../../src/core/content/quests.js";
import { newStory, type Story } from "../../../src/core/game/story.js";
import { stopFor } from "../../../src/core/game/talk.js";
import { NPCS } from "../../../src/core/npcs/index.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import { getRegion, START_REGION, WORLD } from "../../../src/core/world/index.js";
import { TEST_CHARACTER } from "../../fixtures/world.js";
import { doStep, goTo, linesFor, offeredQuest, startIn, talkTo, walkable } from "./helpers.js";

before(() => initPhysics());

const QUEST = "butcher-chickens";
const MARKET = getRegion("market-ward");
const { layout } = WORLD;
const BY_THE_PEN_TILES = 6;

const yardDone = (): Story => ({ ...newStory(), quests: { "bram-yard": { step: null, kills: 0 } } });

function tilesWhere(area: Rect, is: (x: number, z: number) => boolean): Vec2[] {
  const at: Vec2[] = [];
  for (let x = area.x + 0.5; x < area.x + area.w; x++) for (let z = area.z + 0.5; z < area.z + area.h; z++) {
    if (is(x, z)) at.push({ x, z });
  }
  return at;
}

const FENCE = tilesWhere(MARKET.area, (x, z) => tileAt(layout, x, z) === "fence");
const PEN: Rect = (() => {
  const xs = FENCE.map((p) => p.x), zs = FENCE.map((p) => p.z);
  const x = Math.min(...xs) - 0.5, z = Math.min(...zs) - 0.5;
  return { x, z, w: Math.max(...xs) + 0.5 - x, h: Math.max(...zs) + 0.5 - z };
})();
const onEdge = ({ x, z }: Vec2) => x === PEN.x + 0.5 || x === PEN.x + PEN.w - 0.5 || z === PEN.z + 0.5
  || z === PEN.z + PEN.h - 0.5;
const EDGE = tilesWhere(PEN, (x, z) => onEdge({ x, z }));
const INSIDE = tilesWhere(PEN, (x, z) => !onEdge({ x, z }));
const GATE = EDGE.find((p) => !isSolid(layout, p.x, p.z))!;
const butcher = (story = newStory()) => stopFor(story, NPCS.butcher)!;

describe("the Butcher's chickens", () => {
  test("is the main quest right after Bram's yard, and waits for it", () => {
    assert.equal(QUEST_ORDER.indexOf(QUEST), QUEST_ORDER.indexOf("bram-yard") + 1);
    assert.equal(QUESTS[QUEST]!.half, "main");
    assert.deepEqual(QUESTS[QUEST]!.when, { done: "bram-yard" });
    assert.deepEqual(QUESTS[QUEST]!.steps.map((s) => s.task), [
      { kind: "talk", to: "butcher" }, { kind: "kill", enemy: "chicken", count: 3 }, { kind: "talk", to: "butcher" },
    ]);
  });

  test("pays a few coins and something that's already in the game", () => {
    const items = QUESTS[QUEST]!.steps.flatMap((s) => Object.keys(s.reward?.items ?? {}));
    assert.ok(items.some((item) => (COINS as readonly string[]).includes(item)));
  });

  test("Bram, his yard done, sends you on to the Butcher with it, and spars again once it's taken", () => {
    const { session, link } = startIn(START_REGION, { saved: { story: yardDone() } });
    const said = talkTo(session, link, "bram");
    assert.equal(offeredQuest(said.offer), QUEST);
    assert.match(said.lines.join(" "), /butcher/i);
    session.acceptQuest(QUEST);
    assert.equal(session.story.quests[QUEST]?.step, QUESTS[QUEST]!.steps[0]!.id);
    const after = talkTo(session, link, "bram");
    assert.equal(after.offer?.kind, "train");
    assert.match(after.lines.join(" "), /butcher/i);
  });

  test("the Butcher stands by his stall in the Market Ward, on open ground, facing open ground, by his pen", () => {
    const { region, at, heading } = butcher(), way = HEADING_WAY[heading];
    assert.equal(region, "market-ward");
    assert.ok(!isSolid(layout, at.x, at.z));
    assert.ok(!isSolid(layout, at.x + way.x, at.z + way.z));
    assert.ok(tilesWhere(MARKET.area, (x, z) => tileAt(layout, x, z) === "butcherStall")
      .some((stall) => distXZ(stall, at) < 2));
    assert.ok(distXZ(GATE, at) <= BY_THE_PEN_TILES);
  });

  test("a new avatar he sends to Bram first; once the yard's done he offers the work himself", () => {
    const fresh = startIn("market-ward");
    const before = talkTo(fresh.session, fresh.link, "butcher");
    assert.equal(before.offer, null);
    assert.match(before.lines.join(" "), /Bram/);
    const armed = startIn("market-ward", { saved: { story: yardDone() } });
    assert.equal(offeredQuest(talkTo(armed.session, armed.link, "butcher").offer), QUEST);
  });

  test("played through the server: taken from Bram, the Butcher found, three chickens, then back to him", () => {
    const p = startIn(START_REGION, { dev: true, saved: { story: yardDone() } });
    talkTo(p.session, p.link, "bram");
    p.session.acceptQuest(QUEST);
    for (const step of QUESTS[QUEST]!.steps) doStep(p, QUEST, step);
    goTo(p, "market-ward");
    const after = talkTo(p.session, p.link, "butcher");
    assert.equal(after.offer, null);
    assert.deepEqual(after.lines, linesFor(p.session.story, "butcher", { done: QUEST }));
    assert.match(after.lines.join(" "), /South Gate/);
  });
});

describe("the Butcher's pen", () => {
  test("is fenced all round but for one gate, its floor all tall grass", () => {
    assert.ok(INSIDE.length > 0);
    for (const p of INSIDE) assert.ok(inTallGrass(layout, p.x, p.z), `${p.x}, ${p.z}`);
    assert.deepEqual(EDGE.filter((p) => tileAt(layout, p.x, p.z) !== "fence"), [GATE]);
    assert.ok(walkable(getRegion(START_REGION).spawn, GATE));
  });

  test("holds the only tall grass that starts fights in the Market Ward, and its grass rolls only chickens", () => {
    const rolling = tilesWhere(layout.bounds, (x, z) => inTallGrass(layout, x, z)
      && regionAt(layout, x, z).id === "market-ward");
    assert.deepEqual(rolling, INSIDE);
    assert.deepEqual(MARKET.grass!.enemies.map((e) => e.enemy), ["chicken"]);
  });

  test("rolls more often than the wild's grass, so a chicken is soon stirred up", () => {
    assert.ok(MARKET.grass!.chance > getRegion("grass-field").grass!.chance);
  });

  test("walking in from its gate stirs up a chicken", (t: TestContext) => {
    t.mock.method(Math, "random", () => 0);
    const met: EnemyId[] = [], overworld = new Overworld(WORLD);
    const me = overworld.join(TEST_CHARACTER, (_source, enemy) => met.push(enemy));
    overworld.place(me, GATE);
    const middle = { x: PEN.x + PEN.w / 2, z: PEN.z + PEN.h / 2 };
    const across = GATE.x === PEN.x + 0.5 || GATE.x === PEN.x + PEN.w - 0.5;
    const moveX = across ? Math.sign(middle.x - GATE.x) : 0, moveZ = across ? 0 : Math.sign(middle.z - GATE.z);
    let seq = 0;
    for (let i = 0; i < 3 / (layout.playerSpeed * FIXED_DT) && met.length === 0; i++) {
      overworld.input(me, ++seq, moveX, moveZ);
      overworld.step(FIXED_DT);
    }
    assert.deepEqual(met, ["chicken"]);
  });
});
