import assert from "node:assert/strict";
import { before, describe, test, type TestContext } from "node:test";
import {
  bagCounts, Body, distXZ, emptyBag, FIXED_DT, Health, IDLE_INPUT, INTERACT_LOOK_RAD, INTERACT_RANGE_M, ITEMS,
  maxHpOf, NO_PILE, useSteps, type Bag, type GridSpot, type ItemId, type Skill, type Vec2, type Vitals, type Word,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { PLAYER_STATS } from "../../../src/core/content/player.js";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { AFTER_FIGHT_MS, DROP_GAP_M } from "../../../src/core/game/battle.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { INTERACT_LAG_SLACK_M, INTERACT_LOOK_SLACK_RAD } from "../../../src/core/overworld/interact.js";
import { PILE_LIFETIME_MS } from "../../../src/core/overworld/piles.js";
import { pileAt, regenOver, startSession, tick } from "./helpers.js";

before(() => initPhysics());

const REACH_M = INTERACT_RANGE_M + INTERACT_LAG_SLACK_M;
const LOOK_RAD = INTERACT_LOOK_RAD + INTERACT_LOOK_SLACK_RAD;
const DROPPED = rollDrops("wild-boar", () => 0);
const MEAT: Bag = { ...emptyBag(), items: [{ item: "boar-meat", count: 1, x: 0, y: 0, turned: false }] };
const bagSpot = (x: number, y: number): GridSpot => ({ in: "bag", x, y });

const fightOf = (session: GameSession) => session.battle!.room.fight;

/** The client's side: one input a step, as long as the fight runs (after the result too), and a server tick. */
function step(session: GameSession, n = 1, input = IDLE_INPUT): void {
  for (let i = 0; i < n && session.battle; i++) {
    const next = fightOf(session).steps + 1;
    session.battleInput(next, [{ step: next, ...input }]);
    tick(session);
  }
}

/** Stands the server's copy of the player `awayM` short of `at` (south of it), facing `offRad` round from it. */
function faceFrom(session: GameSession, at: Vec2, awayM = 1, offRad = 0): void {
  step(session, 1, { ...IDLE_INPUT, aimX: Math.sin(offRad), aimZ: Math.cos(offRad) });
  const fight = fightOf(session), pos = fight.world.require(fight.players[session.battle!.seat]!, Body).pos;
  Object.assign(pos, { x: at.x, z: at.z - awayM });
}

/** A dev session that has just won against the boar (everything dropped, by default), still in the arena. */
function won(t: TestContext, opts: { random?: number; bag?: Bag; knownWords?: Word[]; vitals?: Vitals } = {}) {
  t.mock.method(Math, "random", () => opts.random ?? 0);
  const { bag = emptyBag(), knownWords = [], vitals } = opts;
  const saved = { bag, knownWords, ...(vitals && { vitals }) };
  const started = startSession({ dev: true, saved });
  const { session } = started;
  const home = { ...session.overworld.playerPos(session.me) };
  session.cheat({ kind: "encounter", enemy: "wild-boar" });
  step(session, 2);
  const fight = fightOf(session), boar = fight.enemies[0]!;
  fight.world.require(boar, Health).hp = 0;
  step(session, 1);
  const fell = { ...fight.world.require(boar, Body).pos };
  step(session, 1);
  const at = started.link.last("arenaDrops").piles[0] ?? fell;
  const pile = () => session.battle?.drops.piles[0]?.pile ?? null;
  const items = () => {
    const p = pile();
    return p === null ? null : session.overworld.pileItems(p);
  };
  const spotOf = (item: ItemId): GridSpot => {
    const s = items()?.items.find((stack) => stack.item === item);
    if (!s) throw new Error(`no ${item} on the pile`);
    return { in: "pile", x: s.x, y: s.y };
  };
  return { ...started, home, fell, at, pile, items, spotOf };
}

function opened(t: TestContext, opts: Parameters<typeof won>[1] = {}) {
  const w = won(t, opts);
  faceFrom(w.session, w.at);
  w.session.openPile();
  return w;
}

describe("a won fight's drops", () => {
  test("lie in the arena beside where the enemy fell, not on the overworld; it stays open AFTER_FIGHT_MS", (t) => {
    const { session, link, home, fell, at, items } = won(t);
    const result = link.last("battleResult");
    assert.equal(result.won, true);
    assert.equal(result.afterFightMs, AFTER_FIGHT_MS);
    assert.deepEqual(bagCounts(items()!), DROPPED);
    assert.equal(link.last("arenaDrops").piles.length, 1);
    const besideM = ENEMIES["wild-boar"].def.radius + DROP_GAP_M;
    assert.ok(Math.abs(distXZ(fell, at) - besideM) < 0.02, "clear of its body");
    assert.ok(Math.hypot(at.x, at.z) < Math.hypot(fell.x, fell.z), "on the arena's inner side");
    assert.equal(pileAt(session.overworld, home, 100), null, "nothing on the overworld yet");
    assert.deepEqual(session.bag, emptyBag(), "nothing packed into the bag");
    assert.equal(session.inOverworld, false);
  });

  test("with nothing dropped, the arena still opens, with nothing in it", (t) => {
    t.mock.property(ENEMIES["wild-boar"], "drops", []);
    const { link } = won(t, { random: 0.999 });
    assert.equal(link.last("battleResult").afterFightMs, AFTER_FIGHT_MS);
    assert.deepEqual(link.last("arenaDrops").piles, []);
  });

  test("a loss doesn't keep the arena open", () => {
    const { session, link } = startSession({ dev: true, saved: { vitals: { hp: 1, stamina: 40 } } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    step(session, 2);
    fightOf(session).world.require(fightOf(session).players[0]!, Health).hp = 0;
    step(session, 2);
    assert.equal(link.last("battleResult").afterFightMs, null);
    assert.equal(session.battle?.room.over, true);
  });

  test("can't be opened mid-fight", () => {
    const { session, link } = startSession({ dev: true });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    step(session, 2);
    const sent = link.all("gear").length;
    session.openPile();
    assert.equal(link.all("gear").length, sent);
  });
});

describe("taking from the arena's drops", () => {
  test("opened within INTERACT_RANGE_M (plus the lag slack) of where the server's fight has you", (t) => {
    const { session, link, at, items } = won(t);
    faceFrom(session, at, REACH_M - 0.05);
    session.openPile();
    assert.deepEqual(link.last("gear").gear.pile, items());
  });

  test("out of reach, nothing opens", (t) => {
    const { session, link, at } = won(t);
    faceFrom(session, at, REACH_M + 0.05);
    session.openPile();
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
  });

  test("only looked at: up to INTERACT_LOOK_RAD (plus the lag slack) round from where the player faces", (t) => {
    const { session, link, at, items } = won(t);
    faceFrom(session, at, 1, LOOK_RAD - 0.02);
    session.openPile();
    assert.deepEqual(link.last("gear").gear.pile, items());
    faceFrom(session, at, 1, -(LOOK_RAD + 0.02));
    session.openPile();
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
  });

  test("facing away, nothing opens, however close", (t) => {
    const { session, link, at } = won(t);
    faceFrom(session, at, 0.5, Math.PI);
    session.openPile();
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
  });

  test("an item dragged into the bag leaves the pile, and the bag is saved soon after", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, link, saves, items, spotOf } = opened(t);
    session.moveItem(spotOf("boar-tusk"), bagSpot(0, 0), false);
    assert.deepEqual(bagCounts(session.bag), { "boar-tusk": 1 });
    assert.equal(bagCounts(items()!)["boar-tusk"], undefined);
    assert.deepEqual(link.last("gear").gear, session.gear);
    t.mock.timers.tick(5000);
    assert.deepEqual(saves.at(-1)?.bag, session.bag);
  });

  test("taking the last of it: the pile is gone, and the arena's drops say so", (t) => {
    const { session, link, items, spotOf } = opened(t);
    for (let i = 0; items() && i < 12; i++) {
      const [stack] = items()!.items;
      session.moveItem(spotOf(stack!.item), bagSpot((i * 2) % 6, 2 * Math.floor(i / 3)), false);
    }
    assert.deepEqual(bagCounts(session.bag), DROPPED);
    step(session, 1);
    assert.deepEqual(link.last("arenaDrops").piles, []);
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
  });

  test("not onto the cloth: the arena has none", (t) => {
    const { session, link, items, spotOf } = opened(t);
    const before = items();
    session.moveItem(spotOf("boar-tusk"), { in: "cloth", x: 0, y: 0 }, false);
    assert.equal(items(), before);
    assert.deepEqual(link.last("gear").gear.cloth.items, []);
  });

  test("eating works there as on the overworld, and the fight's HP follows", (t) => {
    const hp = 50;
    const { session, link } = won(t, { bag: MEAT, vitals: { hp, stamina: 40 } });
    session.useItem({ in: "bag", x: 0, y: 0 });
    assert.deepEqual(link.last("using"), { t: "using", at: { in: "bag", x: 0, y: 0 } });
    step(session, useSteps("boar-meat"));
    const healed = hp + ITEMS["boar-meat"].consumable.effects[0].healShare * maxHpOf(PLAYER_STATS);
    const regen = session.vitals.hp - healed;
    assert.ok(regen >= regenOver(useSteps("boar-meat")) && regen < 1, "healed, and a little came back on its own");
    assert.deepEqual(session.bag, emptyBag());
    assert.equal(link.last("itemUsed").vitals.hp, session.vitals.hp);
    const fight = fightOf(session);
    assert.equal(fight.world.require(fight.players[0]!, Health).hp, session.vitals.hp);
  });

  test("a page can be written there, as outside a fight", (t) => {
    const nova: Skill = { segments: [{ form: "nova", elements: ["fire"], modifiers: [] }] };
    const { session } = won(t, { knownWords: ["nova", "fire"] });
    session.saveSkill(0, nova);
    assert.deepEqual(session.skillbook[0], nova);
  });
});

describe("leaving the arena after a win", () => {
  test("puts them back on the overworld with what they took", (t) => {
    const { session, spotOf } = opened(t);
    session.moveItem(spotOf("boar-tusk"), bagSpot(0, 0), false);
    session.leaveBattle();
    assert.equal(session.inOverworld, true);
    assert.deepEqual(bagCounts(session.bag), { "boar-tusk": 1 });
  });

  test("the leftovers land where the fight began, and their PILE_LIFETIME_MS starts then", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const { session, home, pile } = won(t);
    const left = pile()!;
    t.mock.timers.tick(AFTER_FIGHT_MS / 2);
    session.leaveBattle();
    assert.equal(pileAt(session.overworld, home), left);
    assert.deepEqual(bagCounts(session.overworld.pileItems(left)!), DROPPED);
    t.mock.timers.tick(PILE_LIFETIME_MS - 1);
    session.overworld.step(FIXED_DT);
    assert.notEqual(session.overworld.pileItems(left), null);
    t.mock.timers.tick(1);
    session.overworld.step(FIXED_DT);
    assert.equal(session.overworld.pileItems(left), null);
  });

  test("an open pile closes as they leave", (t) => {
    const { session } = opened(t);
    session.leaveBattle();
    assert.deepEqual(session.gear.pile, NO_PILE);
  });

  test("AFTER_FIGHT_MS after the win, the server sends them out, and the leftovers land", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const { session, link, home, pile } = won(t);
    const left = pile()!;
    t.mock.timers.tick(AFTER_FIGHT_MS - 1);
    step(session, 1);
    assert.equal(link.all("arenaClosed").length, 0);
    t.mock.timers.tick(1);
    step(session, 1);
    assert.equal(link.all("arenaClosed").length, 1);
    assert.equal(session.battle, null);
    assert.equal(pileAt(session.overworld, home), left);
  });

  test("disconnecting isn't a loss: what they took is saved, and the leftovers land", (t) => {
    const { session, saves, home, pile, spotOf } = opened(t);
    const left = pile()!, { overworld } = session;
    session.moveItem(spotOf("boar-tusk"), bagSpot(0, 0), false);
    session.disconnect();
    assert.deepEqual(bagCounts(saves.at(-1)!.bag), { "boar-tusk": 1 });
    assert.equal(saves.at(-1)!.wins, 1);
    assert.equal(pileAt(overworld, home), left);
  });
});
