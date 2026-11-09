import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  appliedStrength, ITEMS, physicalDamage, physicalTakenFactor, strikeDamage, type Hands,
} from "@infinite-tower/shared";
import { PLAYER_STATS } from "../../../src/core/content/player.js";
import { ENEMIES } from "../../../src/core/enemies/index.js";

const CHICKEN = ENEMIES.chicken.def;
const PECK = CHICKEN.attacks.pounce!;
const BOAR = ENEMIES["wild-boar"].def;
const WOOD = ITEMS["wooden-sword"].weapon!;

const lightOnIt = (hands: Hands) => {
  const stats = { ...PLAYER_STATS, strength: appliedStrength(hands, PLAYER_STATS.strength) };
  return strikeDamage(WOOD, "light", 1, stats).blunt * physicalTakenFactor(CHICKEN.stats);
};

describe("the chicken", () => {
  test("falls to the third light swing of the Wooden sword in one hand, sooner held in both", () => {
    const oneHand: Hands = { rightHand: "wooden-sword", leftHand: "skillbook" };
    const hit = lightOnIt(oneHand), bothHands = lightOnIt({ ...oneHand, leftHand: null });
    assert.ok(2 * hit < CHICKEN.maxHp && CHICKEN.maxHp <= 3 * hit, `${hit} a hit against ${CHICKEN.maxHp} HP`);
    assert.ok(bothHands > hit && CHICKEN.maxHp <= 3 * bothHands);
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

  test("is the butcher's, not a monster: no essence, no treasure, no overworld actor", () => {
    const { drops, treasure, overworld } = ENEMIES.chicken;
    assert.deepEqual(drops, []);
    assert.deepEqual(treasure, {});
    assert.deepEqual(overworld(), []);
  });
});
