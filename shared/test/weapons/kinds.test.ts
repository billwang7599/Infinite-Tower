import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AVERAGE_STAT, BASE_STATS, BOW, drawCost, drawnShare, drawTime, ITEMS, loosedDamage, meleeIn, meleeOf, MOVES,
  physicalDamage, rangedOf, WEAPON_KINDS, WEAPONS, wayShape, wayStepsAfter, type Weapon,
} from "@infinite-tower/shared";

const TRAINING_BOW = WEAPONS["training-bow"];

describe("weapon kinds", () => {
  test("every kind says how it fights: the sword swings with the Hybrid's shapes and timings, the bow shoots", () => {
    assert.deepEqual(Object.keys(MOVES).sort(), [...WEAPON_KINDS].sort());
    assert.deepEqual(MOVES.sword, { style: "melee", shape: wayShape, steps: wayStepsAfter });
    assert.equal(MOVES.bow.style, "ranged");
    assert.equal(MOVES.bow, BOW);
  });

  test("melee and ranged are told apart from the weapon, and nothing in hand is neither", () => {
    assert.equal(meleeOf(WEAPONS.sword), MOVES.sword);
    assert.equal(rangedOf(WEAPONS.sword), null);
    assert.equal(rangedOf(TRAINING_BOW), BOW);
    assert.equal(meleeOf(TRAINING_BOW), null);
    assert.equal(meleeOf(null), null);
    assert.equal(rangedOf(null), null);
    assert.equal(meleeIn({ rightHand: "training-bow", leftHand: null }), null);
    assert.equal(meleeIn({ rightHand: "skillbook", leftHand: "sword" }), WEAPONS.sword);
  });

  test("the training bow is a bow; its ammo is an item that stacks in the bag and is worn nowhere", () => {
    assert.equal(TRAINING_BOW.kind, "bow");
    const ammo = ITEMS[BOW.ammo];
    assert.ok(ammo.stackSize > 1 && ammo.cols === 1 && ammo.rows === 1);
    assert.equal("wearable" in ammo, false);
    assert.equal("weapon" in ammo, false);
  });
});

describe("the bow's draw", () => {
  test("its damage grows with the draw, from the least share at once to the bow's own fully drawn", () => {
    const full = drawTime(BOW, TRAINING_BOW, AVERAGE_STAT, "fullTime");
    assert.equal(loosedDamage(BOW, TRAINING_BOW, 0, BASE_STATS),
      physicalDamage(TRAINING_BOW.damage * BOW.draw.minDamageShare, BASE_STATS));
    assert.equal(loosedDamage(BOW, TRAINING_BOW, full, BASE_STATS), physicalDamage(TRAINING_BOW.damage, BASE_STATS));
    assert.equal(loosedDamage(BOW, TRAINING_BOW, full * 3, BASE_STATS), loosedDamage(BOW, TRAINING_BOW, full, BASE_STATS));
    const half = loosedDamage(BOW, TRAINING_BOW, full / 2, BASE_STATS);
    assert.ok(half > loosedDamage(BOW, TRAINING_BOW, 0, BASE_STATS) && half < TRAINING_BOW.damage);
    assert.equal(drawnShare(BOW, TRAINING_BOW, AVERAGE_STAT, full / 2), 0.5);
  });

  test("heft stretches its times and its cost, as it does a swing's", () => {
    const heavy: Weapon = { ...TRAINING_BOW, heft: 1.5 };
    assert.equal(drawTime(BOW, TRAINING_BOW, AVERAGE_STAT, "fullTime"), BOW.draw.fullTime);
    assert.equal(drawTime(BOW, heavy, AVERAGE_STAT, "fullTime"), BOW.draw.fullTime * 1.5);
    assert.equal(drawTime(BOW, heavy, AVERAGE_STAT, "minTime"), BOW.draw.minTime * 1.5);
    assert.equal(drawCost(BOW, heavy, AVERAGE_STAT), BOW.draw.cost * 1.5);
  });
});
