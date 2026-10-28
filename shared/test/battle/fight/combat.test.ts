import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  attackShape, Health, physicalDamage, PLAYER, SWING_DIRS, WEAPONS, type AttackKind,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { duel, input, run, STATS, STATUE } from "./fixtures.js";

before(() => initPhysics());

const SWING_DAMAGE = physicalDamage(WEAPONS.sword.damage, STATS);
const shape = (kind: AttackKind) => attackShape(kind, WEAPONS.sword);
/** Half an attack's arc, either side of the aim. */
const halfArcRad = (kind: AttackKind) => Math.acos(shape(kind).minDot);
/** Center to center, `margin` inside (or, negative, outside) the attack's reach. */
const reach = (kind: AttackKind, margin: number) => shape(kind).range + STATUE.radius - margin;

/** One attack, aimed `aimRad` off the line to a statue `dist` away (center to center). Returns the damage it took. */
function strike(kind: AttackKind, aimRad: number, dist: number, sideways = 0): number {
  const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: sideways, y: 0.05, z: dist });
  run(fight, 0.2);
  const aim = { aimX: Math.sin(aimRad), aimZ: Math.cos(aimRad) };
  run(fight, 0.8, (step) => input({ ...aim, attack: step === 0 ? kind : null }));
  return STATUE.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;
}

describe("a swing", () => {
  test("in every direction, hits a statue in reach straight ahead, once, for the sword's damage", () => {
    for (const dir of SWING_DIRS) assert.equal(strike(dir, 0, reach(dir, 0.3)), SWING_DAMAGE, dir);
  });

  test("hits inside the edge of its arc and misses outside it", () => {
    for (const dir of SWING_DIRS) {
      const edge = halfArcRad(dir);
      assert.equal(strike(dir, edge - 0.12, reach(dir, 0.3)), SWING_DAMAGE, `${dir} inside`);
      assert.equal(strike(dir, -(edge - 0.12), reach(dir, 0.3)), SWING_DAMAGE, `${dir} inside, the other side`);
      assert.equal(strike(dir, edge + 0.12, reach(dir, 0.3)), 0, `${dir} outside`);
      assert.equal(strike(dir, Math.PI, reach(dir, 0.3)), 0, `${dir} behind`);
    }
  });

  test("misses out of reach, even with the step the swing takes", () => {
    for (const dir of SWING_DIRS) assert.equal(strike(dir, 0, reach(dir, -0.8)), 0, dir);
  });

  test("a vertical swing reaches what a horizontal one can't; a horizontal one hits wider", () => {
    const far = reach("lr", -0.4);
    assert.equal(strike("lr", 0, far), 0);
    assert.equal(strike("tb", 0, far), SWING_DAMAGE);
    const wide = (halfArcRad("lr") + halfArcRad("tb")) / 2;
    assert.equal(strike("lr", wide, reach("lr", 0.3)), SWING_DAMAGE);
    assert.equal(strike("tb", wide, reach("lr", 0.3)), 0);
  });

  test("a hit is announced as an event, for the screen shake", () => {
    const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: reach("lr", 0.3) });
    run(fight, 0.2);
    const seen: unknown[] = [];
    run(fight, 0.8, (step) => {
      seen.push(...fight.events);
      return input({ attack: step === 0 ? "lr" : null });
    });
    assert.deepEqual(seen, [{
      type: "hit", by: fight.players[0], target: fight.enemies[0], team: "enemy", damage: SWING_DAMAGE, sword: true,
    }]);
  });
});

describe("the stab", () => {
  const stabDamage = physicalDamage(WEAPONS.sword.damage * PLAYER.stab.damageFactor, STATS);

  test("reaches further than any swing, straight ahead", () => {
    const far = Math.max(...SWING_DIRS.map((dir) => reach(dir, -0.2)));
    assert.ok(far < reach("stab", 0.3));
    assert.equal(strike("stab", 0, reach("stab", 0.3)), stabDamage);
    for (const dir of SWING_DIRS) assert.equal(strike(dir, 0, reach("stab", 0.3)), 0, dir);
  });

  test("is a thin line: a statue just beside it is missed", () => {
    const beside = shape("stab").width + STATUE.radius + 0.15;
    assert.equal(strike("stab", 0, 2, beside - 0.3), stabDamage, "touching the line");
    assert.equal(strike("stab", 0, 2, beside), 0, "beside it");
  });
});
