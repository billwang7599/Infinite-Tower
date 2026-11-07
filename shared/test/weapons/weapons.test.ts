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

  test("the Kobold Greatsword's blade is a greatsword that hits like the Kobold's; Kobolds' blades weigh as ours", () => {
    assert.deepEqual(WEAPONS["kobold-greatsword"], { ...WEAPONS.greatsword, damage: WEAPONS["kobold-blade"].damage });
    assert.equal(WEAPONS["kobold-blade"].heft, WEAPONS.sword.heft);
  });

  test("every weapon is a worn-in-hand item of a known kind", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(ITEMS[id as keyof typeof WEAPONS].wearable.on, "hand", id);
      assert.ok(WEAPON_KINDS.includes(weapon.kind), id);
    }
  });

  test("the Basic Sword is the measure: felt 1 at average strength, twice that at half of it, half at twice", () => {
    assert.equal(feltHeft(WEAPONS.sword, AVERAGE_STAT), 1);
    assert.equal(feltHeft(WEAPONS.sword, AVERAGE_STAT / 2), 2);
    assert.equal(feltHeft(WEAPONS.sword, AVERAGE_STAT * 2), 0.5);
  });

  test("one linear rule for every weapon and guard: heft over the Basic Sword's, over strength's share of 10", () => {
    const guards = [...Object.values(WEAPONS), ITEMS["wooden-shield"].shield];
    for (const guard of guards) {
      for (const strength of [1, AVERAGE_STAT / 2, AVERAGE_STAT, AVERAGE_STAT * 2, 1000]) {
        const want = (guard.heft / WEAPONS.sword.heft) * (AVERAGE_STAT / strength);
        assert.ok(Math.abs(feltHeft(guard, strength) - want) < 1e-9, `${guard.heft} ${strength}`);
      }
    }
  });

  test("the shield and the bow weigh on the swords' scale, as the Basic Sword", () => {
    assert.equal(feltHeft(ITEMS["wooden-shield"].shield, AVERAGE_STAT), 1);
    assert.equal(feltHeft(WEAPONS["training-bow"], AVERAGE_STAT), 1);
  });

  test("strength scales a light weapon too: the Old Stick feels under 1, lighter still to the strong", () => {
    const stick = WEAPONS["old-stick"], felt = (strength: number) => feltHeft(stick, strength);
    assert.ok(felt(AVERAGE_STAT) < 1);
    assert.ok(felt(AVERAGE_STAT / 2) > felt(AVERAGE_STAT) && felt(AVERAGE_STAT) > felt(AVERAGE_STAT * 2));
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
