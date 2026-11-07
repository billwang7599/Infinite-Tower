import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addItem, AVERAGE_STAT, BASE_STATS, BOW, drawCost, drawnShare, drawTime, feltHeft, gripOf, guardOf, ITEM_IDS, itemDef,
  ITEMS, loosedDamage, loosedSpeed, meleeIn, meleeOf, MOVES, nockTime, packFor, physicalDamage, rangedOf, WEAPON_KINDS,
  WEAPONS, wayShape, wayStepsAfter, type ItemId, type Weapon,
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

  test("a melee weapon is held in both hands when the other hand is empty; anything in it makes it one hand", () => {
    const grip = (rightHand: ItemId | null, leftHand: ItemId | null) =>
      gripOf({ rightHand, leftHand, active: "rightHand" });
    assert.equal(grip("sword", null), "two");
    assert.equal(grip(null, "greatsword"), "two");
    assert.equal(grip("kobold-blade", null), "two");
    assert.equal(grip("sword", "skillbook"), "one");
    assert.equal(grip("skillbook", "longsword"), "one");
    assert.equal(grip("sword", "kobold-blade"), "dual");
    assert.equal(grip("sword", "wooden-shield"), "shield");
    assert.equal(grip(null, "wooden-shield"), "shield");
    assert.equal(grip("training-bow", null), "one", "a bow keeps its own grip");
    assert.equal(grip("skillbook", null), null);
    assert.equal(grip(null, null), null);
  });

  test("a one-handed wielder holds a lone blade in one hand, its other hand empty", () => {
    for (const rightHand of ["kobold-blade", "kobold-greatsword"] as const) {
      const hands = { rightHand, leftHand: null, active: "rightHand", oneHanded: true } as const;
      assert.equal(gripOf(hands), "one", rightHand);
      assert.equal(guardOf(hands)!.kind, "one", rightHand);
    }
    assert.equal(gripOf({ rightHand: "kobold-blade", leftHand: "wooden-shield", oneHanded: true }), "shield");
  });

  test("the guard is the grip's: a blade in both hands guards as one blade", () => {
    assert.deepEqual(guardOf({ rightHand: "sword", leftHand: null }), { kind: "one", guard: WEAPONS.sword });
    assert.deepEqual(guardOf({ rightHand: "sword", leftHand: "skillbook" }), { kind: "one", guard: WEAPONS.sword });
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

  test("the arrow leaves at the bow's power × (t² + 2t) / 3, t the share drawn, as Minecraft's bow", () => {
    const full = drawTime(BOW, TRAINING_BOW, AVERAGE_STAT, "fullTime"), power = TRAINING_BOW.powerMps!;
    for (const t of [0, BOW.draw.minTime / BOW.draw.fullTime, 0.5, 0.8, 1]) {
      const speed = loosedSpeed(BOW, TRAINING_BOW, AVERAGE_STAT, full * t);
      assert.ok(Math.abs(speed - (power * (t * t + 2 * t)) / 3) < 1e-9, `${t}: ${speed}`);
    }
    assert.equal(loosedSpeed(BOW, TRAINING_BOW, AVERAGE_STAT, full * 3), power);
    assert.equal(loosedSpeed(BOW, { ...TRAINING_BOW, powerMps: 2 * power }, AVERAGE_STAT, full), 2 * power);
  });

  test("every bow has a power", () => {
    for (const id of ITEM_IDS) {
      const { weapon } = itemDef(id);
      if (weapon && rangedOf(weapon)) assert.ok((weapon.powerMps ?? 0) > 0, id);
    }
  });

  test("the next arrow is nocked quicker out of a quiver than out of the bag", () => {
    const quiver = packFor("training-quiver");
    assert.equal(nockTime(BOW, addItem(quiver, BOW.ammo, 1).bag), BOW.nock.quiverTime);
    assert.equal(nockTime(BOW, quiver), BOW.nock.bagTime);
    assert.equal(nockTime(BOW, packFor(null)), BOW.nock.bagTime);
    assert.ok(BOW.nock.quiverTime < BOW.nock.bagTime);
  });

  test("heft stretches its times and its cost, as it does a swing's", () => {
    const heavy: Weapon = { ...TRAINING_BOW, heft: TRAINING_BOW.heft * 1.5 }, felt = feltHeft(heavy, AVERAGE_STAT);
    assert.equal(drawTime(BOW, TRAINING_BOW, AVERAGE_STAT, "fullTime"), BOW.draw.fullTime);
    assert.ok(felt > 1);
    assert.equal(drawTime(BOW, heavy, AVERAGE_STAT, "fullTime"), BOW.draw.fullTime * felt);
    assert.equal(drawTime(BOW, heavy, AVERAGE_STAT, "minTime"), BOW.draw.minTime * felt);
    assert.equal(drawCost(BOW, heavy, AVERAGE_STAT), BOW.draw.cost * felt);
  });
});
