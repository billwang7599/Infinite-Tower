import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, Health, Player, Posture, POSTURE, POSTURE_MOVES, toSteps, Wielder, type EnemyDef,
  type PlayerInputData, type PostureSwordsmanDef,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, BITER, BOAR, enemy, FULL_HP, input, player, STATUE, swings, SWORDSMAN } from "../../fixtures.js";

before(() => initPhysics());

const BASE = swings({}).posture;
const kobold = (posture: Partial<PostureSwordsmanDef> = {}, over: object = {}): EnemyDef => ({
  ...SWORDSMAN, maxHp: 10_000, walkSpeed: 2.6, sidestep: { chance: 0, reactTime: 0.25, leadTime: 0.1, speed: 8, stepTime: 0.3 },
  attacks: { weapon: swings({ cooldown: 1, ...over, posture: { ...BASE, ...posture } }) },
});

function play(
  def: EnemyDef, steps: number, script: (s: number) => Partial<PlayerInputData> = () => ({}), at = 2,
) {
  const fight = new Fight({
    arena: ARENA, style: "posture", players: [player({ x: 0, y: 0.05, z: 0 })],
    enemies: [enemy(def, { x: 0, y: 0.05, z: at })],
  });
  const events: FightEvent[] = [];
  const run = (n: number, more = script) => {
    for (let i = 0; i < n; i++) {
      fight.step([input({ locked: 0, ...more(fight.steps + 1) })]);
      events.push(...fight.events);
    }
  };
  run(steps);
  return { fight, events, run, me: fight.players[0]!, it: fight.enemies[0]! };
}

const swingOf = (fight: Fight, e: number) => fight.world.require(e, Wielder).swing;
const SWING_AT = 20;
const swingAt = (s: number) => ({ attack: s === SWING_AT ? "light" as const : null });

describe("a swordsman in Posture", () => {
  test("walks up guarding: a player's swing fills its posture", () => {
    const { events, fight, it } = play(kobold({}, { firstDelay: 99 }), 60, swingAt);
    assert.ok(events.some((e) => e.type === "block" && e.target === it));
    assert.equal(fight.world.require(it, Posture).value, POSTURE_MOVES.swing.posture);
    assert.equal(fight.world.require(it, Health).hp, 10_000);
  });

  test("deflects a swing it reads, then strikes at once", () => {
    const { events, fight, me, it, run } = play(kobold({ deflectChance: 1 }, { firstDelay: 99 }), 50, swingAt);
    assert.ok(events.some((e) => e.type === "parry" && e.by === it && e.target === me));
    assert.ok(fight.world.require(me, Player).action === "recoil" || swingOf(fight, it) !== null);
    run(30);
    assert.ok(events.some((e) => e.type === "hit" && e.target === me), "its riposte lands");
  });

  test("a string's swings wind up as its def says, a delayed one later with its blade drawn as quick", () => {
    const [plain, delayed] = [0, 1].map((delayChance) => {
      const { fight, it, run } = play(kobold({ delayChance }), 0);
      while (swingOf(fight, it) === null) run(1);
      return swingOf(fight, it)!;
    });
    assert.equal(plain!.liveAt, toSteps(BASE.windupTime));
    assert.equal(delayed!.liveAt, toSteps(BASE.windupTime + BASE.delayTime));
    assert.equal(delayed!.driveAt, plain!.driveAt);
  });

  test("its strings are as long as its def says; the fourth swing is a finisher", () => {
    const { fight, it, run } = play(kobold({ minString: 4, maxString: 4 }), 0);
    const chains: number[] = [];
    while (chains.length < 4 && fight.steps < 600) {
      run(1);
      const swing = swingOf(fight, it);
      if (swing?.step === 1) chains.push(swing.chain);
      if (chains.length === 4) assert.equal(swing!.attack, "heavy");
    }
    assert.deepEqual(chains, [0, 1, 2, 3]);
  });

  test("a string can end in a thrust, a sweep or a grab", () => {
    for (const end of ["thrust", "sweep"] as const) {
      const ends = { thrust: end === "thrust" ? 1 : 0, sweep: end === "sweep" ? 1 : 0, grab: 0 };
      const { fight, it, run } = play(kobold({ perilousChance: 1, ends }), 0);
      let seen = null;
      while (seen === null && fight.steps < 600) {
        run(1);
        seen = swingOf(fight, it)?.perilous ?? null;
      }
      assert.equal(seen, end);
    }
    const { fight, me, it, run, events } = play(kobold({ perilousChance: 1, ends: { thrust: 0, sweep: 0, grab: 1 } }),
      0, () => ({ block: true }), 1.2);
    while (fight.world.require(it, Enemy).state !== "guardBreak" && fight.steps < 600) run(1);
    const before = fight.world.require(me, Health).hp, posture = fight.world.require(me, Posture).value;
    run(toSteps(POSTURE.grab.windupTime) + 1);
    assert.ok(events.some((e) => e.type === "guardBreak" && e.target === me), "the grab goes through a guard");
    assert.equal(before - fight.world.require(me, Health).hp, POSTURE.grab.damage);
    assert.equal(fight.world.require(me, Posture).value, posture + POSTURE.grab.posture);
  });

  test("a dodge beats its grab", () => {
    const { fight, me, it, run } = play(kobold({ perilousChance: 1, ends: { thrust: 0, sweep: 0, grab: 1 } }),
      0, () => ({}), 1.2);
    while (fight.world.require(it, Enemy).state !== "guardBreak" && fight.steps < 600) run(1);
    const before = fight.world.require(me, Health).hp, at = fight.steps + toSteps(POSTURE.grab.windupTime) - 4;
    run(toSteps(POSTURE.grab.windupTime) + 2, (s) => ({ dodge: s === at, moveX: s === at ? 1 : 0 }));
    assert.equal(fight.world.require(me, Health).hp, before);
  });

  test("over its back-off share of posture it backs away instead of attacking", () => {
    const { fight, it, run } = play(kobold({ backOffShare: 0.7 }, { firstDelay: 0.2 }), 1);
    const posture = fight.world.require(it, Posture);
    posture.value = posture.max * 0.8;
    posture.calmTime = -99;
    const from = fight.world.require(it, Body).pos.z;
    run(60);
    assert.ok(fight.world.require(it, Body).pos.z > from + 0.5);
    assert.equal(swingOf(fight, it), null);
  });

  test("steps back from a sweep it reads", () => {
    const { fight, it } = play(kobold({ sweepStepBackChance: 1 }, { firstDelay: 99 }), SWING_AT + 1,
      (s) => ({ perilous: s === SWING_AT ? "sweep" : null }));
    assert.equal(fight.world.require(it, Enemy).state, "sidestep");
  });

  test("breaks when full: staggered, and the next weapon hit is a deathblow", () => {
    const { fight, it, run, events } = play(kobold({}, { firstDelay: 99 }), 1);
    const posture = fight.world.require(it, Posture);
    posture.value = posture.max - 1;
    run(SWING_AT + 30, (s) => swingAt(s + 1));
    assert.ok(events.some((e) => e.type === "posture" && e.what === "broken" && e.target === it));
    assert.equal(fight.world.require(it, Enemy).state, "staggered");
    const before = fight.world.require(it, Health).hp, again = fight.steps + 2;
    run(30, (s) => ({ attack: s === again ? "light" : null }));
    assert.ok(events.some((e) => e.type === "posture" && e.what === "deathblow"));
    assert.ok(Math.abs(before - fight.world.require(it, Health).hp - 10_000 * POSTURE.broken.deathblowShare) < 1e-6);
  });
});

describe("the boar and the Warlock in Posture", () => {
  const guardedBiter: EnemyDef = { ...BITER, attacks: { lunge: { ...BITER.attacks.lunge!, posture: 30 } } };

  test("a lunge with a posture number is guarded for it, or deflected for the body blow's posture", () => {
    const held = play(guardedBiter, 60, () => ({ block: true }), 2.4);
    assert.ok(held.events.some((e) => e.type === "block" && e.target === held.me));
    assert.equal(held.fight.world.require(held.me, Health).hp, FULL_HP);
    assert.ok(held.fight.world.require(held.me, Posture).value > 0);
    const lunge = guardedBiter.attacks.lunge!, landsAt = toSteps(lunge.windup) + 2;
    const tapped = play(guardedBiter, landsAt + 4, (s) => ({ block: s >= landsAt - 2 }), 2.4);
    assert.ok(tapped.events.some((e) => e.type === "parry" && e.by === tapped.me));
    assert.equal(tapped.fight.world.require(tapped.it, Posture).value, POSTURE.deflect.bodyBlowPosture);
  });

  test("a body blow with none (the boar's charge) can't be guarded", () => {
    const { events, fight, me } = play(BOAR, 200, () => ({ block: true }), 7);
    assert.ok(events.some((e) => e.type === "hit" && e.target === me));
    assert.ok(fight.world.require(me, Health).hp < FULL_HP);
    assert.ok(!events.some((e) => e.type === "block"));
  });

  test("a fighter with no blade never guards: every swing lands, filling its posture by half", () => {
    const { events, fight, it } = play({ ...STATUE, posture: 80 }, SWING_AT + 30, swingAt, 2.4);
    assert.ok(events.some((e) => e.type === "hit" && e.target === it));
    assert.equal(fight.world.require(it, Posture).value, POSTURE_MOVES.swing.posture * POSTURE.hitShare);
    assert.equal(fight.world.require(it, Posture).max, 80);
  });
});
