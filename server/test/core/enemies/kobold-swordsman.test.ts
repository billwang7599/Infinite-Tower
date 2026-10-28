/** The Kobold Swordsman as tuned: beatable by a player who reads its wind-ups, and no pushover for one who doesn't. */
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, IDLE_INPUT, isSwing, liveStep, SWING, Player, PLAYER, reverseOf, Wielder,
  type AttackKind, type EnemyDef, type PlayerInputData, type Skill,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { fightWith } from "../../fixtures/fight.js";

before(() => initPhysics());

const KOBOLD = ENEMIES["kobold-swordsman"].def;
const LIVE_AFTER = liveStep(SWING.setTime + SWING.driveTime);

/**
 * Keeps about a sword's length away, facing it. Parries each swing (the reverse, its blade live two steps before
 * the Kobold's lands), blocks its stabs, and swings back, left and right, only while it's open: recovering,
 * stunned or staggered.
 */
const lastAttacks = new WeakMap<Fight, AttackKind>();
function watchful(fight: Fight): PlayerInputData {
  const me = fight.world.require(fight.players[0]!, Player), at = fight.world.require(fight.players[0]!, Body).pos;
  const kobold = fight.world.require(fight.enemies[0]!, Enemy), it = fight.world.require(fight.enemies[0]!, Body).pos;
  const mine = fight.world.require(fight.players[0]!, Wielder).swing;
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
    if (landsIn === LIVE_AFTER + 2) input.attack = reverseOf(its.attack);
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

  test("swinging at it on guard gets you parried", () => {
    const fight = fightWith(KOBOLD, 1);
    let parried = 0;
    for (let i = 0; i < 20 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
      const input = watchful(fight);
      if (fight.world.require(fight.enemies[0]!, Enemy).state === "approach" && i % 30 === 0) input.attack = "tb";
      fight.step([input]);
      parried += fight.events.filter((e) => e.type === "parry" && e.by === fight.enemies[0]).length;
    }
    assert.ok(parried > 0);
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
