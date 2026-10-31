import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, GUARD_BREAK, GUARD_SIDES, Health, IDLE_INPUT, mirrorSide, Player, WeaponAttack,
  Wielder,
  type EnemyDef, type GuardSide, type PlayerInputData, type Skill,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { fightWith, FULL } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;

const TECH_AT = Math.round((GUARD_BREAK.grabTime + KOBOLD.attacks.weapon!.counters!.reactTime) / FIXED_DT);

/**
 * Keeps about a sword's length away, locked on. Holds the guard that blocks the Kobold's (across from its side, as it
 * sees it) whenever it might attack, attacks from another side only while it's walking up, recovering or reeling,
 * and counters its guard breaks a human reaction late.
 */
function watchful(fight: Fight): PlayerInputData {
  const me = fight.world.require(fight.players[0]!, Player), at = fight.world.require(fight.players[0]!, Body).pos;
  const kobold = fight.world.require(fight.enemies[0]!, Enemy), it = fight.world.require(fight.enemies[0]!, Body).pos;
  const guard = fight.world.require(fight.enemies[0]!, WeaponAttack);
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.3 ? 1 : dist < 1.5 ? -1 : 0;
  const blocking = mirrorSide(guard.guard);
  const input: PlayerInputData = {
    ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ, locked: 0, guard: blocking,
  };
  const open = kobold.state === "weaponRecover" || kobold.state === "recoil" || kobold.state === "staggered"
    || (kobold.state === "approach" && guard.guardMoveTime === 0 && guard.cooldown > 1);
  if (open && me.action === "none" && fight.steps % 2 === 0) {
    input.guard = GUARD_SIDES.find((side) => side !== blocking)!;
    input.attack = "light";
  }
  input.guardBreak = fight.world.require(fight.enemies[0]!, Wielder).grab?.step === TECH_AT;
  return input;
}

describe("the Kobold Swordsman", () => {
  test("a player who reads its guard beats it, whatever its seed", () => {
    for (const seed of [1, 2, 3, 1234, 99999]) {
      const fight = fightWith(KOBOLD, seed);
      while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([watchful(fight)]);
      const hp = fight.world.require(fight.players[0]!, Health).hp;
      console.log(`seed ${seed}: ${fight.outcome.state} in ${(fight.steps / 60).toFixed(1)} s, ${hp} HP left`);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > FULL.hp / 3, `seed ${seed}: ${hp} HP left`);
    }
  });

  test("a player who never moves their guard loses to it", () => {
    const fight = fightWith(KOBOLD, 1);
    while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) {
      fight.step([{ ...watchful(fight), guard: "top", attack: null }]);
    }
    assert.equal(fight.outcome.state, "lost");
  });

  function attackAtGuard(def: EnemyDef, side: (guarded: GuardSide) => GuardSide) {
    const fight = fightWith(def, 1), e = fight.enemies[0]!, guard = fight.world.require(e, WeaponAttack);
    let blocked = 0, landed = 0;
    for (let i = 0; i < 20 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
      const input = watchful(fight), kobold = fight.world.require(e, Enemy);
      const settled = kobold.state === "approach" && guard.guardMoveTime === 0 && guard.guardHoldTime > 1
        && guard.cooldown > 1;
      const free = fight.world.require(fight.players[0]!, Player).action === "none";
      input.attack = null;
      if (settled && free && i % 2 === 0) Object.assign(input, { guard: side(guard.guard), attack: "light" });
      fight.step([input]);
      for (const event of fight.events) {
        if (event.type === "block" && event.target === e) blocked++;
        if (event.type === "hit" && event.target === e) landed++;
      }
    }
    return { blocked, landed };
  }

  for (const id of ["kobold-swordsman", "kobold-greatsword"] as const) {
    test(`${id}: attacking from across its guard gets you blocked; from another side, it lands`, () => {
      const def = ENEMIES[id].def;
      const across = attackAtGuard(def, mirrorSide);
      assert.ok(across.blocked > 0);
      assert.equal(across.landed, 0);
      const other = attackAtGuard(def, (guarded) => GUARD_SIDES.find((s) => s !== mirrorSide(guarded))!);
      assert.equal(other.blocked, 0);
      assert.ok(other.landed > 0);
    });
  }

  test("each chained attack holds its whole chain wind-up first, its tell", () => {
    const def = KOBOLD.attacks.weapon!;
    assert.ok(def.chainWindup < def.windup, "the opener's is longer still");
    for (const seed of [1, 2, 3]) {
      const fight = fightWith(KOBOLD, seed), it = () => fight.world.require(fight.enemies[0]!, Enemy);
      const chained: number[] = [];
      for (let i = 0; i < 30 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
        const was = it().state;
        fight.step([IDLE_INPUT]);
        if (was === "weapon" && it().state === "weaponWindup") chained.push(it().duration);
      }
      assert.ok(chained.length > 2, `seed ${seed}`);
      for (const t of chained) assert.equal(t, def.chainWindup, `seed ${seed}: ${chained.join(", ")}`);
    }
  });

  test("its own blade never drops, even on the lowest roll", () => {
    assert.equal(KOBOLD.wielder?.hands.rightHand, "kobold-blade");
    assert.deepEqual(rollDrops("kobold-swordsman", () => 0), { "kobold-swordsman-essence": 1 }, "only its essence");
  });
});

describe("stepping aside from a Bolt", () => {
  const BOLT: Skill = { segments: [{ form: "bolt", elements: [], modifiers: [] }] };
  const stepsAside = (def: EnemyDef, seed: number) => {
    const fight = fightWith(def, seed);
    const aimed = { ...IDLE_INPUT, aimX: 0, aimZ: 1 };
    fight.step([{ ...aimed, chant: true }]);
    fight.step([{ ...aimed, cast: BOLT }]);
    for (let i = 0; i < 1 / FIXED_DT; i++) {
      fight.step([aimed]);
      if (fight.world.require(fight.enemies[0]!, Enemy).state === "sidestep") return true;
    }
    return false;
  };
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

  test("the Kobold sometimes does", () => assert.ok(seeds.some((seed) => stepsAside(KOBOLD, seed))));
  test("the boar never does", () => assert.ok(!seeds.some((seed) => stepsAside(ENEMIES["wild-boar"].def, seed))));
});
