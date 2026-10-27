import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Health, physicalDamage, PLAYER } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { duel, input, run, STATS, STATUE } from "./fixtures.js";

before(() => initPhysics());

const SLASH_DAMAGE = physicalDamage(PLAYER.slash.damage, STATS);
/** Half the slash's arc, either side of the aim. */
const HALF_ARC_RAD = Math.acos(PLAYER.slash.minDot);
const IN_REACH = PLAYER.slash.range + STATUE.radius - 0.3;

/** One slash, aimed `aimRad` off the line to a boar `dist` away (center to center). Returns the damage it took. */
function slash(aimRad: number, dist: number): number {
  const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: dist });
  run(fight, 0.2);
  run(fight, 0.6, (step) => input({ aimX: Math.sin(aimRad), aimZ: Math.cos(aimRad), attack: step === 0 }));
  return STATUE.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;
}

describe("the slash", () => {
  test("hits a boar in reach straight ahead, once, for the slash's damage", () => {
    assert.equal(slash(0, IN_REACH), SLASH_DAMAGE);
  });

  test("hits inside the edge of its arc", () => {
    assert.equal(slash(HALF_ARC_RAD - 0.15, IN_REACH), SLASH_DAMAGE);
    assert.equal(slash(-(HALF_ARC_RAD - 0.15), IN_REACH), SLASH_DAMAGE);
  });

  test("misses outside its arc", () => {
    assert.equal(slash(HALF_ARC_RAD + 0.15, IN_REACH), 0);
    assert.equal(slash(Math.PI, IN_REACH), 0);
  });

  test("misses out of reach, even with the step the swing takes", () => {
    assert.equal(slash(0, PLAYER.slash.range + STATUE.radius + 0.8), 0);
  });

  test("a hit is announced as an event, for the screen shake", () => {
    const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: IN_REACH });
    run(fight, 0.2);
    const seen: unknown[] = [];
    run(fight, 0.6, (step) => {
      seen.push(...fight.events);
      return input({ attack: step === 0 });
    });
    assert.deepEqual(seen, [{ type: "hit", target: fight.enemies[0], team: "enemy", damage: SLASH_DAMAGE }]);
  });
});
