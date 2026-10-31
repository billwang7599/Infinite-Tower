import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Health, physicalDamage, PLAYER, wayShape, WEAPONS, type SwingDir } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { duel, input, run, STATS, STATUE } from "./fixtures.js";

before(() => initPhysics());

const DAMAGE = physicalDamage(WEAPONS.sword.damage, STATS);
const WAYS: readonly SwingDir[] = ["lr", "tb", "tlbr"];
const shape = (way: SwingDir) => wayShape(way, PLAYER.armReachM, WEAPONS.sword);
/** Half an attack's arc, either side of the aim. */
const halfArcRad = (way: SwingDir) => Math.acos(shape(way).minDot);
/** Center to center, `margin` inside (or, negative, outside) the attack's reach. */
const reach = (way: SwingDir, margin: number) => shape(way).range + STATUE.radius - margin;

function strike(way: SwingDir, aimRad: number, dist: number, sideways = 0): number {
  const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: sideways, y: 0.05, z: dist });
  run(fight, 0.2);
  const aim = { aimX: Math.sin(aimRad), aimZ: Math.cos(aimRad), locked: 0, way };
  run(fight, 0.8, (step) => input({ ...aim, attack: step === 0 ? "light" : null }));
  return STATUE.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;
}

describe("an attack", () => {
  test("every way, hits a statue in reach straight ahead, once, for the sword's damage", () => {
    for (const way of WAYS) assert.equal(strike(way, 0, reach(way, 0.3)), DAMAGE, way);
  });

  test("hits inside the edge of its arc and misses outside it", () => {
    for (const way of WAYS) {
      const edge = halfArcRad(way);
      assert.equal(strike(way, edge - 0.12, reach(way, 0.3)), DAMAGE, `${way} inside`);
      assert.equal(strike(way, -(edge - 0.12), reach(way, 0.3)), DAMAGE, `${way} inside, the other side`);
      assert.equal(strike(way, edge + 0.12, reach(way, 0.3)), 0, `${way} outside`);
      assert.equal(strike(way, Math.PI, reach(way, 0.3)), 0, `${way} behind`);
    }
  });

  test("misses out of reach, even with the step the attack takes", () => {
    for (const way of WAYS) assert.equal(strike(way, 0, reach(way, -0.8)), 0, way);
  });

  test("a vertical swing reaches what a horizontal one can't; a horizontal one hits wider", () => {
    const far = reach("lr", -0.4);
    assert.equal(strike("lr", 0, far), 0);
    assert.equal(strike("tb", 0, far), DAMAGE);
    const wide = (halfArcRad("lr") + halfArcRad("tb")) / 2;
    assert.equal(strike("lr", wide, reach("lr", 0.3)), DAMAGE);
    assert.equal(strike("tb", wide, reach("lr", 0.3)), 0);
  });

  test("a hit is announced as an event, for the screen shake", () => {
    const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: reach("lr", 0.3) });
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
