import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, releaseTime, Enemy, FIXED_DT, Health, SKILL_EFFECTS, SkillObject, type EnemyDef, type PlayerInputData, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, castNow, enemy, IDLE, input, player, segment, skill, STATUE, STEPPER } from "../fixtures.js";

before(() => initPhysics());

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const ME = at(0, -4), THEM = at(0, 4);
const BOLT = skill(segment("bolt", ["water"]));
const STEP = STEPPER.sidestep!;

const fightWith = (def: EnemyDef, { me = ME, them = THEM, seed = 1, radius = ARENA.radius } = {}) =>
  new Fight({ arena: { ...ARENA, radius }, players: [player(me)], enemies: [{ ...enemy(def, them), seed }] });
const them = (fight: Fight) => fight.enemies[0]!;
const lostHp = (fight: Fight) => {
  const health = fight.world.require(them(fight), Health);
  return health.max - health.hp;
};
const bolts = (fight: Fight) => [...fight.world.query(SkillObject)].length;
const untilDone = (fight: Fight) => {
  for (let i = 0; i < 240 && bolts(fight) > 0; i++) fight.step([IDLE]);
};
const castAt = (fight: Fight, over: Partial<PlayerInputData> = {}) => {
  castNow(fight, BOLT, over);
  untilDone(fight);
};

describe("stepping aside from a Bolt", () => {
  test("a Bolt aimed at it misses: it's out of the line by the time the Bolt gets there", () => {
    const stepper = fightWith(STEPPER), statue = fightWith(STATUE);
    castAt(stepper);
    castAt(statue);
    assert.equal(lostHp(stepper), 0);
    assert.ok(lostHp(statue) > 0);
    const moved = Math.abs(stepper.world.require(them(stepper), Body).pos.x - THEM.x);
    assert.ok(moved > STEPPER.radius + SKILL_EFFECTS.bolt.radiusM, `moved ${moved}`);
  });

  test("it starts stepping its lead time before the Bolt leaves, so the caster can't re-aim", () => {
    const fight = fightWith(STEPPER);
    let stepAt = -1, firedAt = -1;
    const watch = (i: number) => {
      if (stepAt < 0 && fight.world.require(them(fight), Enemy).state === "sidestep") stepAt = i;
      if (firedAt < 0 && bolts(fight) > 0) firedAt = i;
    };
    fight.step([input({ chant: true })]);
    fight.step([input({ cast: BOLT })]);
    for (let i = 0; i < 60; i++) {
      fight.step([IDLE]);
      watch(i);
    }
    assert.equal(firedAt - stepAt, Math.round(STEP.leadTime / FIXED_DT));
  });

  test("a cast quicker than its reaction catches it", () => {
    const slow: EnemyDef = { ...STEPPER, sidestep: { ...STEP, reactTime: releaseTime(BOLT) + 0.05 } };
    const fight = fightWith(slow);
    castAt(fight);
    assert.ok(lostHp(fight) > 0);
  });

  test("busy (stunned, here), it doesn't react", () => {
    const fight = fightWith(STEPPER);
    Object.assign(fight.world.require(them(fight), Enemy), { state: "stunned", duration: 5 });
    castAt(fight);
    assert.ok(lostHp(fight) > 0);
  });

  test("a Bolt aimed elsewhere leaves it standing", () => {
    const fight = fightWith(STEPPER);
    castAt(fight, { aimX: 1, aimZ: 0 });
    assert.equal(fight.world.require(them(fight), Enemy).state, "approach");
    assert.ok(Math.abs(fight.world.require(them(fight), Body).pos.z - THEM.z) < 0.01);
  });

  test("it steps away from the wall, never into it", () => {
    const radius = 12, wallSide = at(0, 10);
    for (let seed = 1; seed <= 8; seed++) {
      const fight = fightWith(STEPPER, { me: at(-6, 10), them: wallSide, seed, radius });
      castAt(fight, { aimX: 1, aimZ: 0 });
      assert.ok(fight.world.require(them(fight), Body).pos.z < wallSide.z, `seed ${seed}`);
    }
  });

  test("with a chance, only sometimes; the fight's seed decides, the same on every machine", () => {
    const coinFlip: EnemyDef = { ...STEPPER, sidestep: { ...STEP, chance: 0.5 } };
    const dodged = (seed: number) => {
      const fight = fightWith(coinFlip, { seed });
      castAt(fight);
      return lostHp(fight) === 0;
    };
    const runs = Array.from({ length: 16 }, (_, i) => dodged(i + 1));
    assert.ok(runs.some((d) => d) && runs.some((d) => !d), runs.join());
    assert.deepEqual(Array.from({ length: 16 }, (_, i) => dodged(i + 1)), runs);
  });
});
