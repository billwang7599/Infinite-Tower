import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  canWield, coreStats, DAMAGE_PER_HEFT, DAMAGE_PROFILES, DAMAGE_TYPES, heftShare, ITEMS, newCore, STRENGTH_DISCOUNT,
  strengthDiscount, WEAPON_KINDS, weaponDamage, weaponIn, weaponItemIn, WEAPONS, type Damage, type Weapon,
} from "@infinite-tower/shared";

const swingOf = (damage: Damage) => damage.slash + damage.blunt;
const SWORDS = ["sword", "kobold-blade", "longsword", "greatsword", "kobold-greatsword"] as const;

describe("the arsenal", () => {
  test("a weapon in either hand is found, the right hand's first; other things in hand are no weapon", () => {
    assert.equal(weaponItemIn({ rightHand: "skillbook", leftHand: "sword" }), "sword");
    assert.equal(weaponItemIn({ rightHand: "kobold-blade", leftHand: "sword" }), "kobold-blade");
    assert.equal(weaponItemIn({ rightHand: "skillbook", leftHand: null }), null);
    assert.equal(weaponIn({ rightHand: null, leftHand: "kobold-blade" }), WEAPONS["kobold-blade"]);
  });

  test("sword, longsword, greatsword: each longer, slower and harder swinging", () => {
    const ladder = [WEAPONS.sword, WEAPONS.longsword, WEAPONS.greatsword];
    for (let i = 1; i < ladder.length; i++) {
      const lighter = ladder[i - 1]!, heavier = ladder[i]!;
      assert.ok(heavier.length > lighter.length && heavier.heft > lighter.heft);
      assert.ok(swingOf(weaponDamage(heavier)) > swingOf(weaponDamage(lighter)));
    }
  });

  test("the Kobolds' blades are ours: the Kobold blade a Basic Sword, the greatsword ours but lighter to hold", () => {
    assert.deepEqual(WEAPONS["kobold-blade"], WEAPONS.sword);
    const { minStrength, ...kobold } = WEAPONS["kobold-greatsword"];
    const { minStrength: ours, ...great } = WEAPONS.greatsword;
    assert.deepEqual(kobold, great);
    assert.ok(minStrength < ours);
  });

  test("every weapon is a worn-in-hand item of a known kind", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(ITEMS[id as keyof typeof WEAPONS].wearable.on, "hand", id);
      assert.ok(WEAPON_KINDS.includes(weapon.kind), id);
    }
  });

  test("the Basic Sword is the measure: every weapon's share is its heft over the Basic Sword's", () => {
    assert.equal(heftShare(WEAPONS.sword), 1);
    for (const guard of [...Object.values(WEAPONS), ITEMS["wooden-shield"].shield]) {
      assert.ok(Math.abs(heftShare(guard) - guard.heft / WEAPONS.sword.heft) < 1e-12, `${guard.heft}`);
    }
  });

  test("the shield and the bow weigh as the Basic Sword; the Old Stick is lighter", () => {
    assert.equal(heftShare(ITEMS["wooden-shield"].shield), 1);
    assert.equal(heftShare(WEAPONS["training-bow"]), 1);
    assert.ok(heftShare(WEAPONS["old-stick"]) < 1);
  });

  test("strength over a weapon's minimum takes 1.5% a point off its costs, at most half, never adding any", () => {
    const sword = WEAPONS.sword, at = (over: number) => strengthDiscount(sword, sword.minStrength + over);
    assert.equal(STRENGTH_DISCOUNT.perPoint, 0.015);
    assert.equal(STRENGTH_DISCOUNT.max, 0.5);
    assert.equal(at(0), 1);
    assert.equal(at(-3), 1);
    assert.ok(Math.abs(at(4) - 0.94) < 1e-12, `${at(4)}`);
    assert.ok(Math.abs(at(20) - 0.7) < 1e-12, `${at(20)}`);
    assert.equal(at(1000), 0.5);
    assert.ok(Math.abs(strengthDiscount({ minStrength: 6 }, 10) - 0.94) < 1e-12);
  });

  test("a weapon can be wielded from its minimum strength up, not below", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(canWield(id as keyof typeof WEAPONS, weapon.minStrength), true, id);
      if (weapon.minStrength > 0) assert.equal(canWield(id as keyof typeof WEAPONS, weapon.minStrength - 1), false, id);
    }
    assert.ok(WEAPONS.greatsword.minStrength > WEAPONS.longsword.minStrength);
    assert.ok(WEAPONS.longsword.minStrength > WEAPONS.sword.minStrength);
    assert.ok(WEAPONS.sword.minStrength > WEAPONS["old-stick"].minStrength);
  });

  test("a new player can wield the Old Stick and the Basic Sword in one hand", () => {
    const strength = coreStats(newCore()).strength;
    assert.ok(canWield("old-stick", strength) && canWield("sword", strength), `${strength}`);
  });
});

describe("a weapon's damage, by type", () => {
  const ruled = (weapon: Weapon) => DAMAGE_PER_HEFT * weapon.heft * (weapon.quality ?? 1);

  test("a sword's swing is DAMAGE_PER_HEFT × heft × quality, its profile splitting it into whole numbers", () => {
    for (const id of SWORDS) {
      const weapon = WEAPONS[id], damage = weaponDamage(weapon), shares = DAMAGE_PROFILES[weapon.profile];
      assert.equal(weapon.baseDamage, undefined, id);
      for (const type of DAMAGE_TYPES) {
        assert.ok(Number.isInteger(damage[type]), `${id} ${type}: ${damage[type]}`);
        assert.ok(Math.abs(damage[type] - ruled(weapon) * shares[type]) <= 0.5, `${id} ${type}: ${damage[type]}`);
      }
      assert.ok(Math.abs(swingOf(damage) - ruled(weapon)) <= 1, `${id}: ${swingOf(damage)}`);
    }
  });

  test("every current weapon is of quality 1, and quality multiplies the whole of it", () => {
    for (const weapon of Object.values(WEAPONS)) assert.equal(weapon.quality ?? 1, 1);
    const better = weaponDamage({ ...WEAPONS.greatsword, quality: 2 }), plain = weaponDamage(WEAPONS.greatsword);
    for (const type of DAMAGE_TYPES) assert.ok(Math.abs(better[type] - 2 * plain[type]) <= 1, type);
    assert.ok(swingOf(better) > swingOf(plain));
  });

  test("a melee profile's slash and blunt shares make the whole swing; its stab is a part of it", () => {
    for (const weapon of Object.values(WEAPONS).filter((w) => w.kind === "sword")) {
      const shares = DAMAGE_PROFILES[weapon.profile];
      assert.ok(Math.abs(shares.slash + shares.blunt - 1) < 1e-9, weapon.profile);
      assert.ok(shares.stab > 0 && shares.stab < 1, weapon.profile);
    }
  });

  test("a sword cuts more than it bludgeons and stabs well below its swing", () => {
    for (const id of SWORDS) {
      const damage = weaponDamage(WEAPONS[id]);
      assert.ok(damage.slash > damage.blunt && damage.blunt > 0, id);
      assert.ok(damage.stab > 0 && damage.stab < 0.75 * swingOf(damage), `${id}: ${damage.stab}`);
    }
  });

  test("the longsword is the thrusting sword, the greatsword the bluntest and the poorest stabber", () => {
    const share = (id: (typeof SWORDS)[number]) => DAMAGE_PROFILES[WEAPONS[id].profile];
    assert.ok(share("longsword").stab > share("sword").stab && share("sword").stab > share("greatsword").stab);
    assert.ok(share("greatsword").blunt > share("sword").blunt);
  });

  test("the old stick is off the rule, by its own data: a blunt swing, no edge, a weak poke", () => {
    const stick = WEAPONS["old-stick"], damage = weaponDamage(stick);
    assert.ok(stick.baseDamage !== undefined && stick.baseDamage !== ruled(stick));
    assert.deepEqual({ slash: damage.slash, blunt: damage.blunt }, { slash: 0, blunt: stick.baseDamage });
    assert.ok(damage.stab > 0 && damage.stab < damage.blunt);
  });

  test("a bow's arrow is all stab, at the bow's own damage, off the melee rule", () => {
    const bow = WEAPONS["training-bow"];
    assert.ok(bow.baseDamage !== undefined && bow.baseDamage !== ruled(bow));
    assert.deepEqual(weaponDamage(bow), { slash: 0, stab: bow.baseDamage, blunt: 0 });
  });
});
