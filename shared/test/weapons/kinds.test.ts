import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addItem, appliedStrength, BASE_STATS, BOW, drawCost, drawnShare, drawTime, gripOf, guardOf, ITEM_IDS,
  itemDef, ITEMS, loosedDamage, loosedSpeed, meleeIn, meleeOf, MOVES, nockTime, packFor, physicalDamage, rangedOf,
  strengthDiscount, strengthTimeFactor, TWO_HAND_STRENGTH_FACTOR, WEAPON_CLASSES, weaponDamage, WEAPONS, wayShape, wayStepsAfter, type ItemId,
  type RangedWeapon,
} from "@infinite-tower/shared";

const TRAINING_BOW = WEAPONS["training-bow"];

describe("weapon classes", () => {
  test("every class says how it fights: every sword swings with the Hybrid's shapes and timings, the bow shoots", () => {
    assert.deepEqual(Object.keys(MOVES).sort(), [...WEAPON_CLASSES].sort());
    for (const cls of ["shortsword", "longsword", "greatsword"] as const) {
      assert.deepEqual(MOVES[cls], { style: "melee", shape: wayShape, steps: wayStepsAfter }, cls);
    }
    assert.equal(MOVES.bow.style, "ranged");
    assert.equal(MOVES.bow, BOW);
  });

  test("melee and ranged are told apart from the weapon, and nothing in hand is neither", () => {
    assert.equal(meleeOf(WEAPONS.sword), MOVES.shortsword);
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

  test("a two-handed grip puts TWO_HAND_STRENGTH_FACTOR times the wielder's strength into the weapon", () => {
    const applied = (rightHand: ItemId | null, leftHand: ItemId | null) =>
      appliedStrength({ rightHand, leftHand, active: "rightHand" }, BASE_STATS.strength);
    assert.ok(TWO_HAND_STRENGTH_FACTOR > 1);
    assert.equal(applied("greatsword", null), BASE_STATS.strength * TWO_HAND_STRENGTH_FACTOR);
    for (const [right, left] of [["greatsword", "skillbook"], ["sword", "kobold-blade"], ["sword", "wooden-shield"],
      ["training-bow", null], [null, null]] as const) {
      assert.equal(applied(right, left), BASE_STATS.strength, `${right} and ${left}`);
    }
    const oneHanded = { rightHand: "kobold-blade", leftHand: null, oneHanded: true } as const;
    assert.equal(appliedStrength(oneHanded, BASE_STATS.strength), BASE_STATS.strength, "a one-handed wielder's");
  });

  test("the guard is the grip's: a blade in both hands guards as one blade", () => {
    assert.deepEqual(guardOf({ rightHand: "sword", leftHand: null }), { kind: "one", guard: WEAPONS.sword });
    assert.deepEqual(guardOf({ rightHand: "sword", leftHand: "skillbook" }), { kind: "one", guard: WEAPONS.sword });
  });

  test("the training bow is a bow; its ammo is an item that stacks in the bag and is worn nowhere", () => {
    assert.equal(TRAINING_BOW.class, "bow");
    const ammo = ITEMS[BOW.ammo];
    assert.ok(ammo.stackSize > 1 && ammo.cols === 1 && ammo.rows === 1);
    assert.equal("wearable" in ammo, false);
    assert.equal("weapon" in ammo, false);
  });
});

describe("the bow's draw", () => {
  const S = BASE_STATS.strength;

  test("its damage grows with the draw, from the least share at once to the bow's own fully drawn", () => {
    const full = drawTime(TRAINING_BOW, "fullTime", S), arrow = weaponDamage(TRAINING_BOW).stab;
    const stab = (drawnTime: number) => loosedDamage(BOW, TRAINING_BOW, drawnTime, BASE_STATS).stab;
    assert.equal(stab(0), physicalDamage(arrow * BOW.draw.minDamageShare, BASE_STATS));
    assert.equal(stab(full), physicalDamage(arrow, BASE_STATS));
    assert.equal(stab(full * 3), stab(full));
    assert.ok(stab(full / 2) > stab(0) && stab(full / 2) < arrow);
    assert.equal(drawnShare(TRAINING_BOW, full / 2, S), 0.5);
  });

  test("an arrow is all stab", () => {
    const full = drawTime(TRAINING_BOW, "fullTime", S);
    for (const drawnTime of [0, full / 2, full]) {
      const { slash, blunt, stab } = loosedDamage(BOW, TRAINING_BOW, drawnTime, BASE_STATS);
      assert.deepEqual({ slash, blunt }, { slash: 0, blunt: 0 });
      assert.ok(stab > 0);
    }
  });

  test("the arrow leaves at the bow's power × (t² + 2t) / 3, t the share drawn, as Minecraft's bow", () => {
    const full = drawTime(TRAINING_BOW, "fullTime", S), power = TRAINING_BOW.powerMps;
    for (const t of [0, TRAINING_BOW.draw.minTime / TRAINING_BOW.draw.fullTime, 0.5, 0.8, 1]) {
      const speed = loosedSpeed(TRAINING_BOW, full * t, S);
      assert.ok(Math.abs(speed - (power * (t * t + 2 * t)) / 3) < 1e-9, `${t}: ${speed}`);
    }
    assert.equal(loosedSpeed(TRAINING_BOW, full * 3, S), power);
    assert.equal(loosedSpeed({ ...TRAINING_BOW, powerMps: 2 * power }, full, S), 2 * power);
  });

  test("every bow has a power", () => {
    for (const id of ITEM_IDS) {
      const { weapon } = itemDef(id);
      if (weapon?.class === "bow") assert.ok(weapon.powerMps > 0, id);
    }
  });

  test("the next arrow is nocked quicker out of a quiver than out of the bag", () => {
    const quiver = packFor("training-quiver");
    assert.equal(nockTime(BOW, addItem(quiver, BOW.ammo, 1).bag), BOW.nock.quiverTime);
    assert.equal(nockTime(BOW, quiver), BOW.nock.bagTime);
    assert.equal(nockTime(BOW, packFor(null)), BOW.nock.bagTime);
    assert.ok(BOW.nock.quiverTime < BOW.nock.bagTime);
  });

  test("its times and cost are its table's at its minimum; strength over it quickens them a little, cuts the cost", () => {
    const bow: RangedWeapon = { ...TRAINING_BOW, minStrength: 6 }, min = bow.minStrength, over = min + 10;
    assert.equal(drawTime(bow, "fullTime", min), bow.draw.fullTime);
    assert.equal(drawTime(bow, "minTime", min), bow.draw.minTime);
    assert.equal(drawCost(bow, min), bow.draw.cost);
    assert.equal(drawTime(bow, "fullTime", over), bow.draw.fullTime * strengthTimeFactor(bow, over));
    assert.ok(drawTime(bow, "fullTime", over) < bow.draw.fullTime);
    assert.equal(drawCost(bow, over), bow.draw.cost * strengthDiscount(bow, over));
  });
});
