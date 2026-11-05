import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  appliedStrength, Body, emptyEquipment, FIXED_DT, Health, IDLE_INPUT, ITEMS, physicalDamage, physicalTakenFactor,
  strikeDamage, type Hands, type PlayerInputData,
} from "@infinite-tower/shared";
import { ENEMY_START, ENEMY_START_YAW, Fight, initPhysics } from "@infinite-tower/shared/fight";
import { PLAYER_STATS } from "../../../src/core/content/player.js";
import { ENEMIES } from "../../../src/core/enemies/index.js";
import { FULL, setupWith } from "../../fixtures/fight.js";

before(() => initPhysics());

const CHICKEN = ENEMIES.chicken.def;
const PECK = CHICKEN.attacks.pounce!;
const BOAR = ENEMIES["wild-boar"].def;
const STICK = ITEMS["old-stick"].weapon!;
const SEEDS = [1, 2, 3, 1234, 99999];
const MOST_LOST_SHARE = 0.25;

const lightOnIt = (hands: Hands) => {
  const stats = { ...PLAYER_STATS, strength: appliedStrength(hands, PLAYER_STATS.strength) };
  return strikeDamage(STICK, "light", 1, stats).blunt * physicalTakenFactor(CHICKEN.stats);
};

function withStick(seed: number): Fight {
  const setup = setupWith(CHICKEN), [player] = setup.players;
  const equipment = { ...emptyEquipment(), rightHand: "old-stick" as const };
  return new Fight({
    ...setup,
    players: [{ ...player!, gear: { ...player!.gear, equipment } }],
    enemies: [{ def: CHICKEN, at: ENEMY_START, yaw: ENEMY_START_YAW, seed }],
  });
}

function masher(fight: Fight): PlayerInputData {
  const at = fight.world.require(fight.players[0]!, Body).pos, it = fight.world.require(fight.enemies[0]!, Body).pos;
  const dx = it.x - at.x, dz = it.z - at.z, dist = Math.hypot(dx, dz) || 1;
  return { ...IDLE_INPUT, aimX: dx / dist, aimZ: dz / dist, moveX: dx / dist, moveZ: dz / dist, locked: 0,
    attack: fight.steps % 2 === 0 ? "light" : null };
}

describe("the chicken", () => {
  test("falls to the third light swing of the old stick, held in one hand or in both", () => {
    const oneHand: Hands = { rightHand: "old-stick", leftHand: "skillbook" };
    for (const held of [oneHand, { ...oneHand, leftHand: null }]) {
      const hit = lightOnIt(held);
      assert.ok(2 * hit < CHICKEN.maxHp && CHICKEN.maxHp <= 3 * hit, `${hit} a hit against ${CHICKEN.maxHp} HP`);
    }
  });

  test("pecks for a sliver of a fresh avatar's HP, far less than a boar bites", () => {
    const peck = physicalDamage(PECK.damage, CHICKEN.stats) * physicalTakenFactor(PLAYER_STATS);
    assert.ok(peck >= 1 && peck <= 2, `${peck}`);
    assert.ok(PECK.damage < BOAR.attacks.lunge!.damage / 5);
  });

  test("is quicker than the boar, and hops back off after every peck", () => {
    assert.ok(CHICKEN.walkSpeed > BOAR.walkSpeed);
    assert.ok(PECK.hopSpeed > 0 && PECK.hopTime > 0);
  });

  test("a fresh avatar who only swings the old stick at it beats it, whatever its seed, losing little", () => {
    for (const seed of SEEDS) {
      const fight = withStick(seed);
      while (fight.outcome.state === "fighting" && fight.steps < 60 / FIXED_DT) fight.step([masher(fight)]);
      const hp = fight.world.require(fight.players[0]!, Health).hp;
      assert.equal(fight.outcome.state, "won", `seed ${seed}: ${hp} HP after ${fight.steps * FIXED_DT} s`);
      assert.ok(hp > FULL.hp * (1 - MOST_LOST_SHARE), `seed ${seed}: ${hp} HP left`);
    }
  });

  test("is the butcher's, not a monster: no essence, no treasure, no overworld actor", () => {
    const { drops, treasure, overworld } = ENEMIES.chicken;
    assert.deepEqual(drops, []);
    assert.deepEqual(treasure, {});
    assert.deepEqual(overworld(), []);
  });
});
