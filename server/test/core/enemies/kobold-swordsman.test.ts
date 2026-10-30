/** The Kobold Swordsman as tuned: beatable by a player who reads its wind-ups, and no pushover for one who doesn't. */
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, FighterStats, GUARD, Health, IDLE_INPUT, isSwing, liveStep, planSwing, Player, PLAYER,
  reverseOf, SWING_DIRS, swingSide, WeaponAttack, weaponIn, Wielder, type AttackKind, type EnemyDef,
  type PlayerInputData, type Skill,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { fightWith } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;

/**
 * Keeps about a sword's length away, facing it. Parries each swing (the reverse, from wherever its own blade is, live
 * two steps before the Kobold's lands), blocks its stabs, and swings back, left and right, only while it's open:
 * recovering, stunned or staggered.
 */
const lastAttacks = new WeakMap<Fight, AttackKind>();
function watchful(fight: Fight): PlayerInputData {
  const me = fight.world.require(fight.players[0]!, Player), at = fight.world.require(fight.players[0]!, Body).pos;
  const kobold = fight.world.require(fight.enemies[0]!, Enemy), it = fight.world.require(fight.enemies[0]!, Body).pos;
  const wielder = fight.world.require(fight.players[0]!, Wielder), mine = wielder.swing;
  const its = fight.world.require(fight.enemies[0]!, Wielder).swing;
  if (mine) lastAttacks.set(fight, mine.attack);
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  const aimX = dx / dist, aimZ = dz / dist, toward = dist > 2.3 ? 1 : dist < 1.5 ? -1 : 0;
  const input: PlayerInputData = {
    ...IDLE_INPUT, moveX: aimX * toward, moveZ: aimZ * toward, aimX, aimZ,
  };
  const winding = kobold.state === "weaponWindup" || kobold.state === "weapon";
  if (winding && its && !isSwing(its.attack)) return { ...input, moveX: 0, moveZ: 0, block: true };
  if (kobold.state === "weaponWindup" && its && isSwing(its.attack)) {
    const landsIn = Math.ceil((kobold.duration - kobold.stateTime) / FIXED_DT - 1e-6);
    const strength = fight.world.require(fight.players[0]!, FighterStats).strength, reverse = reverseOf(its.attack);
    const liveAfter = liveStep(planSwing(weaponIn(wielder.hands)!, strength, wielder.blade, reverse).windupTime);
    if (landsIn === liveAfter + 2) input.attack = reverse;
    return input;
  }
  const open = kobold.state === "weaponRecover" || kobold.state === "parried" || kobold.state === "staggered";
  const free = me.action === "none" || (mine !== null && mine.step >= mine.letGoAt);
  if (open && free && fight.steps % 2 === 0) input.attack = (lastAttacks.get(fight) ?? "lr") === "lr" ? "rl" : "lr";
  return input;
}

describe("the Kobold Swordsman", () => {
  test("a player who reads its wind-ups beats it, whatever its seed", () => {
    for (const seed of [1, 2, 3, 1234, 99999]) {
      const fight = fightWith(KOBOLD, seed);
      while (fight.outcome.state === "fighting" && fight.steps < 180 / FIXED_DT) fight.step([watchful(fight)]);
      const hp = fight.world.require(fight.players[0]!, Health).hp;
      console.log(`seed ${seed}: ${fight.outcome.state} in ${(fight.steps / 60).toFixed(1)} s, ${hp} HP left`);
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP left after ${fight.steps} steps`);
      assert.ok(hp > PLAYER.maxHp / 3, `seed ${seed}: ${hp} HP left`);
    }
  });

  function swingAtGuard(def: EnemyDef, side: (guarded: number) => number) {
    const fight = fightWith(def, 1), e = fight.enemies[0]!, guard = fight.world.require(e, WeaponAttack);
    let parried = 0, landed = 0, sent = false;
    for (let i = 0; i < 20 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
      const input = watchful(fight), kobold = fight.world.require(e, Enemy);
      const settled = kobold.state === "approach" && kobold.stateTime > def.attacks.weapon!.parryReaction
        && guard.guardMoveTime === 0 && guard.guardHoldTime > 1;
      const free = fight.world.require(fight.players[0]!, Player).action === "none";
      if (settled && free && i % 30 === 0) {
        input.attack = SWING_DIRS.find((d) => swingSide(d) === side(guard.guardSide))!;
        sent = true;
      }
      fight.step([input]);
      for (const event of fight.events) {
        if (event.type === "parry" && event.by === e) parried++;
        if (sent && event.type === "hit" && event.target === e) landed++;
      }
      if (fight.world.require(e, Enemy).state !== "approach") sent = false;
    }
    return { parried, landed };
  }

  for (const id of ["kobold-swordsman", "kobold-greatsword"] as const) {
    test(`${id}: swinging at the side it guards gets you parried; at the far side, it lands`, () => {
      const def = ENEMIES[id].def;
      assert.ok(swingAtGuard(def, (guarded) => guarded).parried > 0);
      const far = swingAtGuard(def, (guarded) => (guarded + GUARD.sides / 2) % GUARD.sides);
      assert.equal(far.parried, 0);
      assert.ok(far.landed > 0);
    });
  }

  test("each chained swing winds up for its whole chain wind-up, a longer tell than its blade needs", () => {
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
    assert.deepEqual(rollDrops("kobold-swordsman", () => 0), {});
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
