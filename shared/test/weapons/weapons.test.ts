import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AVERAGE_STAT, canWield, feltHeft, ITEMS, WEAPON_KINDS, weaponIn, weaponItemIn, WEAPONS,
} from "@infinite-tower/shared";

describe("the arsenal", () => {
  test("a weapon in either hand is found, the right hand's first; other things in hand are no weapon", () => {
    assert.equal(weaponItemIn({ rightHand: "skillbook", leftHand: "sword" }), "sword");
    assert.equal(weaponItemIn({ rightHand: "kobold-blade", leftHand: "sword" }), "kobold-blade");
    assert.equal(weaponItemIn({ rightHand: "skillbook", leftHand: null }), null);
    assert.equal(weaponIn({ rightHand: null, leftHand: "kobold-blade" }), WEAPONS["kobold-blade"]);
  });

  test("sword, longsword, greatsword: each longer, slower and harder hitting", () => {
    const ladder = [WEAPONS.sword, WEAPONS.longsword, WEAPONS.greatsword];
    for (let i = 1; i < ladder.length; i++) {
      const lighter = ladder[i - 1]!, heavier = ladder[i]!;
      assert.ok(heavier.length > lighter.length && heavier.heft > lighter.heft && heavier.damage > lighter.damage);
    }
  });

  test("the Kobold Greatsword's blade is a greatsword that hits like the Kobold's", () => {
    assert.deepEqual({ ...WEAPONS["kobold-greatsword"], damage: WEAPONS["kobold-blade"].damage },
      { ...WEAPONS.greatsword, damage: WEAPONS["kobold-blade"].damage });
  });

  test("every weapon is a worn-in-hand item of a known kind", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(ITEMS[id as keyof typeof WEAPONS].wearable.on, "hand", id);
      assert.ok(WEAPON_KINDS.includes(weapon.kind), id);
    }
  });

  test("strength scales a weapon's heft: the average feels it as it is, twice that half the extra, half twice", () => {
    const { heft } = WEAPONS.greatsword;
    assert.equal(feltHeft(WEAPONS.greatsword, AVERAGE_STAT), heft);
    assert.equal(feltHeft(WEAPONS.greatsword, AVERAGE_STAT * 2), 1 + (heft - 1) / 2);
    assert.equal(feltHeft(WEAPONS.greatsword, AVERAGE_STAT / 2), 1 + (heft - 1) * 2);
    for (const strength of [AVERAGE_STAT / 2, AVERAGE_STAT, AVERAGE_STAT * 2]) {
      assert.equal(feltHeft(WEAPONS.sword, strength), 1, `${strength}`);
    }
  });

  test("a weapon can be wielded from its minimum strength up, not below", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(canWield(id as keyof typeof WEAPONS, weapon.minStrength), true, id);
      if (weapon.minStrength > 0) assert.equal(canWield(id as keyof typeof WEAPONS, weapon.minStrength - 1), false, id);
    }
    assert.ok(WEAPONS.greatsword.minStrength > WEAPONS.longsword.minStrength);
    assert.ok(WEAPONS.longsword.minStrength > WEAPONS.sword.minStrength);
  });
});
