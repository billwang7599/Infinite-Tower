import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  attackSteps, ATTACKS, ENEMY_GUARD, Enemy, FIXED_DT, GUARD_SIDES, Health, mirrorSide, Player, WeaponAttack, WEAPONS,
  Wielder, type GuardSide, type WeaponAttackData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, GUARDIAN, input, player } from "../fixtures.js";

before(() => initPhysics());

const SETTLED = 60;
const LIVE_AFTER = attackSteps(WEAPONS.sword, "light", 0).liveAt;
const MOVE_STEPS = Math.round(ENEMY_GUARD.moveTime / FIXED_DT);

const newFight = (seed = 1) => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })],
  enemies: [{ ...enemy(GUARDIAN, { x: 0, y: 0.05, z: 2 }), seed }],
});
const guardOf = (fight: Fight): WeaponAttackData => fight.world.require(fight.enemies[0]!, WeaponAttack);
const hurtBy = (fight: Fight) => GUARDIAN.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;

function holding(fight: Fight, side: GuardSide): Fight {
  Object.assign(guardOf(fight), { guard: side, guardFrom: side, guardMoveTime: 0, guardHoldTime: 999 });
  return fight;
}

function attackAt(fight: Fight, side: GuardSide, at: number, settle = 10): FightEvent[] {
  const events: FightEvent[] = [];
  while (fight.steps < at + LIVE_AFTER + settle) {
    fight.step([input({ locked: 0, guard: side, attack: fight.steps + 1 === at ? "light" : null })]);
    events.push(...fight.events);
  }
  return events;
}

describe("a swordsman's guard", () => {
  test("it blocks an attack from the side across from it, as it sees it; the other two land", () => {
    for (const guard of GUARD_SIDES) {
      for (const side of GUARD_SIDES) {
        const fight = holding(newFight(), guard);
        const events = attackAt(fight, side, SETTLED);
        const across = side === mirrorSide(guard);
        assert.equal(events.some((e) => e.type === "block"), across, `${guard} guard, from ${side}`);
        assert.equal(hurtBy(fight) === 0, across, `${guard} guard, from ${side}`);
      }
    }
  });

  test("blocked, the player recoils for the attack's recoil time, then can act again", () => {
    const fight = holding(newFight(), "left"), me = fight.players[0]!;
    assert.ok(attackAt(fight, "right", SETTLED, 0).some((e) => e.type === "block"));
    const blockedAt = fight.steps;
    assert.equal(fight.world.require(me, Player).action, "recoil");
    assert.equal(fight.world.require(me, Wielder).swing, null);
    const recoilSteps = Math.round(ATTACKS.light.recoilTime / FIXED_DT);
    while (fight.steps < blockedAt + recoilSteps - 1) fight.step([input({ locked: 0, guard: "right" })]);
    assert.equal(fight.world.require(me, Player).action, "recoil", "still");
    while (fight.steps < blockedAt + recoilSteps + 2) fight.step([input({ locked: 0, guard: "right" })]);
    assert.equal(fight.world.require(me, Player).action, "none");
  });

  test("hit from a side it isn't guarding, it turns its guard there: the same attack again is blocked", () => {
    const fight = holding(newFight(), "top");
    assert.ok(attackAt(fight, "left", SETTLED).some((e) => e.type === "hit"), "the first lands");
    const guard = guardOf(fight);
    assert.equal(guard.guard, mirrorSide("left"));
    assert.ok(guard.guardHoldTime >= ENEMY_GUARD.minHoldTime - MOVE_STEPS * FIXED_DT, `${guard.guardHoldTime}`);
    assert.ok(attackAt(fight, "left", fight.steps + 30).some((e) => e.type === "block"), "the second is blocked");
  });

  test("while its guard moves, the old side stays covered; the new one only once the move is done", () => {
    const moving = () => {
      const fight = holding(newFight(), "left");
      Object.assign(guardOf(fight), { guard: "right", guardMoveTime: 999 });
      return fight;
    };
    assert.ok(attackAt(moving(), mirrorSide("left"), SETTLED).some((e) => e.type === "block"), "the old side");
    assert.ok(attackAt(moving(), mirrorSide("right"), SETTLED).some((e) => e.type === "hit"), "the new side");
  });

  test("left alone, it changes side every minHoldTime..maxHoldTime, by the fight's seed", () => {
    const sidesOver = (seed: number) => {
      const fight = newFight(seed), changes: { step: number; side: GuardSide }[] = [];
      let last = guardOf(fight).guard;
      while (fight.steps < 40 / FIXED_DT) {
        fight.step([input({})]);
        const side = guardOf(fight).guard;
        if (side !== last) changes.push({ step: fight.steps, side });
        last = side;
      }
      return changes;
    };
    const changes = sidesOver(1);
    assert.ok(changes.length >= 40 / ENEMY_GUARD.maxHoldTime - 1, `${changes.length} changes`);
    for (let i = 1; i < changes.length; i++) {
      const held = (changes[i]!.step - changes[i - 1]!.step) * FIXED_DT;
      assert.ok(held >= ENEMY_GUARD.minHoldTime - FIXED_DT && held <= ENEMY_GUARD.maxHoldTime + FIXED_DT, `${held}`);
    }
    assert.deepEqual(sidesOver(1), changes, "the same seed, the same sides");
    assert.notDeepEqual(sidesOver(2), changes, "another seed, others");
    assert.equal(new Set(changes.map((c) => c.side)).size, GUARD_SIDES.length, "it uses every side");
  });

  test("recovering or stunned, it isn't guarding", () => {
    for (const state of ["weaponRecover", "staggered", "recoil"] as const) {
      const fight = holding(newFight(), "left");
      while (fight.steps < SETTLED - 1) fight.step([input({})]);
      Object.assign(fight.world.require(fight.enemies[0]!, Enemy), { state, stateTime: 0, duration: 99 });
      assert.ok(attackAt(fight, mirrorSide("left"), SETTLED).some((e) => e.type === "hit"), state);
    }
  });
});
