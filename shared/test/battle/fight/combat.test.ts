import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  attackShape, GUARD_SIDES, Health, physicalDamage, PLAYER, WEAPONS, type GuardSide,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { duel, input, run, STATS, STATUE } from "./fixtures.js";

before(() => initPhysics());

const DAMAGE = physicalDamage(WEAPONS.sword.damage, STATS);
const shape = (side: GuardSide) => attackShape(side, PLAYER.armReachM, WEAPONS.sword);
/** Half an attack's arc, either side of the aim. */
const halfArcRad = (side: GuardSide) => Math.acos(shape(side).minDot);
/** Center to center, `margin` inside (or, negative, outside) the attack's reach. */
const reach = (side: GuardSide, margin: number) => shape(side).range + STATUE.radius - margin;

function strike(side: GuardSide, aimRad: number, dist: number, sideways = 0): number {
  const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: sideways, y: 0.05, z: dist });
  run(fight, 0.2);
  const aim = { aimX: Math.sin(aimRad), aimZ: Math.cos(aimRad), locked: 0, guard: side };
  run(fight, 0.8, (step) => input({ ...aim, attack: step === 0 ? "light" : null }));
  return STATUE.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;
}

describe("an attack", () => {
  test("from every side, hits a statue in reach straight ahead, once, for the sword's damage", () => {
    for (const side of GUARD_SIDES) assert.equal(strike(side, 0, reach(side, 0.3)), DAMAGE, side);
  });

  test("hits inside the edge of its arc and misses outside it", () => {
    for (const side of GUARD_SIDES) {
      const edge = halfArcRad(side);
      assert.equal(strike(side, edge - 0.12, reach(side, 0.3)), DAMAGE, `${side} inside`);
      assert.equal(strike(side, -(edge - 0.12), reach(side, 0.3)), DAMAGE, `${side} inside, the other side`);
      assert.equal(strike(side, edge + 0.12, reach(side, 0.3)), 0, `${side} outside`);
      assert.equal(strike(side, Math.PI, reach(side, 0.3)), 0, `${side} behind`);
    }
  });

  test("misses out of reach, even with the step the attack takes", () => {
    for (const side of GUARD_SIDES) assert.equal(strike(side, 0, reach(side, -0.8)), 0, side);
  });

  test("from the top it reaches what one from a side can't; from a side it hits wider", () => {
    const far = reach("left", -0.4);
    assert.equal(strike("left", 0, far), 0);
    assert.equal(strike("top", 0, far), DAMAGE);
    const wide = (halfArcRad("left") + halfArcRad("top")) / 2;
    assert.equal(strike("left", wide, reach("left", 0.3)), DAMAGE);
    assert.equal(strike("top", wide, reach("left", 0.3)), 0);
  });

  test("a hit is announced as an event, for the screen shake", () => {
    const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: reach("left", 0.3) });
    run(fight, 0.2);
    const seen: unknown[] = [];
    run(fight, 0.8, (step) => {
      seen.push(...fight.events);
      return input({ attack: step === 0 ? "light" : null });
    });
    assert.deepEqual(seen, [{
      type: "hit", by: fight.players[0], target: fight.enemies[0], team: "enemy", damage: DAMAGE, weapon: true,
    }]);
  });
});
