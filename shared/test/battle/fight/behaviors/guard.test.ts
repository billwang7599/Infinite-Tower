import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  FIXED_DT, GUARD, Health, liveStep, SCREEN_DIR, SWING, SWING_DIRS, WeaponAttack, Wielder, type AttackKind,
  type SwingDir, type WeaponAttackData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, GUARD as GUARDING, input, player } from "../fixtures.js";

before(() => initPhysics());

const SETTLED = 60;
const LIVE_AFTER = liveStep(SWING.setTime + SWING.driveTime);
const MOVE_STEPS = Math.round(GUARD.moveTime / FIXED_DT);
const STEP_RAD = (2 * Math.PI) / GUARD.sides;

const newFight = (seed = 1) => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })],
  enemies: [{ ...enemy(GUARDING, { x: 0, y: 0.05, z: 2 }), seed }],
});
const guardOf = (fight: Fight): WeaponAttackData => fight.world.require(fight.enemies[0]!, WeaponAttack);
const hurtBy = (fight: Fight) => GUARDING.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;

function holding(fight: Fight, side: number): Fight {
  Object.assign(guardOf(fight), { guardSide: side, guardFrom: side, guardMoveTime: 0, guardHoldTime: 999 });
  return fight;
}

/** Where a swing comes in from, as the player sees it (radians, anticlockwise from the right). */
const fromRad = (dir: SwingDir) => Math.atan2(-SCREEN_DIR[dir].y, -SCREEN_DIR[dir].x);
const apartRad = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const comingFrom = (side: number): SwingDir => SWING_DIRS.find((d) => apartRad(fromRad(d), side * STEP_RAD) < 1e-6)!;

function swingAt(fight: Fight, attack: AttackKind, at: number, settle = 10): FightEvent[] {
  const events: FightEvent[] = [];
  while (fight.steps < at + LIVE_AFTER + settle) {
    fight.step([input({ attack: fight.steps + 1 === at ? attack : null })]);
    events.push(...fight.events);
  }
  return events;
}

describe("a swordsman's guard", () => {
  test("held toward a side, it parries the swings coming in within 45° of it (3 of 8); the other 5 land", () => {
    for (let side = 0; side < GUARD.sides; side++) {
      const parried: SwingDir[] = [];
      for (const dir of SWING_DIRS) {
        const fight = holding(newFight(), side);
        const events = swingAt(fight, dir, SETTLED);
        const near = apartRad(fromRad(dir), side * STEP_RAD) <= Math.PI / 4 + 1e-6;
        if (events.some((e) => e.type === "parry")) parried.push(dir);
        assert.equal(hurtBy(fight) === 0, near, `side ${side}, ${dir}`);
      }
      assert.equal(parried.length, 3, `side ${side}: ${parried.join(", ")}`);
    }
  });

  test("a stab is blocked whatever side it guards", () => {
    for (let side = 0; side < GUARD.sides; side++) {
      const fight = holding(newFight(), side);
      const events = swingAt(fight, "stab", SETTLED, 30);
      assert.ok(events.some((e) => e.type === "block"), `side ${side}`);
      assert.equal(hurtBy(fight), 0, `side ${side}`);
    }
  });

  test("hit from a side it isn't guarding, it turns its guard there: the same swing again is parried", () => {
    const fight = holding(newFight(), 0), dir = comingFrom(4);
    const first = swingAt(fight, dir, SETTLED);
    assert.ok(first.some((e) => e.type === "hit"), "the first lands");
    const guard = guardOf(fight);
    assert.equal(guard.guardSide, 4);
    assert.ok(guard.guardHoldTime >= GUARD.minHoldTime - MOVE_STEPS * FIXED_DT, `${guard.guardHoldTime}`);
    const again = swingAt(fight, dir, fight.steps + 30);
    assert.ok(again.some((e) => e.type === "parry"), "the second is parried");
  });

  test("while its guard moves, the old side stays covered; the new one only once the move is done", () => {
    const moving = (fight: Fight) =>
      Object.assign(guardOf(fight), { guardSide: 4, guardFrom: 0, guardMoveTime: 999, guardHoldTime: 999 });
    const old = holding(newFight(), 0), fresh = holding(newFight(), 0);
    moving(old);
    moving(fresh);
    assert.ok(swingAt(old, comingFrom(0), SETTLED).some((e) => e.type === "parry"), "the old side");
    assert.ok(swingAt(fresh, comingFrom(4), SETTLED).some((e) => e.type === "hit"), "the new side");
  });

  test("it holds its blade out toward its side, and moving there takes GUARD.moveTime", () => {
    const fight = holding(newFight(), 0), wielder = fight.world.require(fight.enemies[0]!, Wielder);
    const toward = (side: number) =>
      ({ x: Math.cos(side * STEP_RAD) * GUARD.bladeOut, y: Math.sin(side * STEP_RAD) * GUARD.bladeOut });
    const off = (side: number) => Math.hypot(wielder.blade.x - toward(side).x, wielder.blade.y - toward(side).y);
    while (fight.steps < SETTLED) fight.step([input({})]);
    assert.ok(off(0) < 1e-9, JSON.stringify(wielder.blade));
    assert.equal(wielder.blade.vx, 0);
    assert.equal(wielder.blade.vy, 0);

    Object.assign(guardOf(fight), { guardSide: 2, guardFrom: 0, guardMoveTime: GUARD.moveTime });
    for (let i = 0; i < MOVE_STEPS / 2; i++) fight.step([input({})]);
    assert.ok(off(2) > 0.1 && off(0) > 0.1, `halfway: ${off(2)}, ${off(0)}`);
    assert.equal(guardOf(fight).guardFrom, 0, "the old side still covered");
    for (let i = 0; i < MOVE_STEPS; i++) fight.step([input({})]);
    assert.ok(off(2) < 1e-9, "there");
    assert.equal(guardOf(fight).guardFrom, 2, "the new side covered");
  });

  test("left alone, it changes side every minHoldTime..maxHoldTime, by the fight's seed", () => {
    const sidesOver = (seed: number) => {
      const fight = newFight(seed), changes: { step: number; side: number }[] = [];
      let last = guardOf(fight).guardSide;
      while (fight.steps < 40 / FIXED_DT) {
        fight.step([input({})]);
        const side = guardOf(fight).guardSide;
        if (side !== last) changes.push({ step: fight.steps, side });
        last = side;
      }
      return changes;
    };
    const changes = sidesOver(1);
    assert.ok(changes.length >= 40 / GUARD.maxHoldTime - 1, `${changes.length} changes`);
    for (let i = 1; i < changes.length; i++) {
      const held = (changes[i]!.step - changes[i - 1]!.step) * FIXED_DT;
      assert.ok(held >= GUARD.minHoldTime - FIXED_DT && held <= GUARD.maxHoldTime + FIXED_DT, `held ${held}`);
    }
    assert.deepEqual(sidesOver(1), changes, "the same seed, the same sides");
    assert.notDeepEqual(sidesOver(2), changes, "another seed, others");
    assert.ok(new Set(changes.map((c) => c.side)).size > 3, "it uses many sides");
  });
});
