import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ITEMS, WEAPON_KINDS, weaponIn, weaponItemIn, WEAPONS } from "@infinite-tower/shared";

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
});
