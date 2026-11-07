import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AVERAGE_STAT, DAMAGE_PER_HEFT, DAMAGE_PROFILES, DAMAGE_TYPES, FELT_HEFT_FLOOR, feltHeft, ITEMS, strengthHeftFactor,
  WEAPON_KINDS, weaponDamage, weaponIn, weaponItemIn, WEAPONS, type Damage, type Weapon,
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

  test("the Kobolds' blades are ours: the Kobold blade a Basic Sword, the Kobold greatsword a greatsword", () => {
    assert.deepEqual(WEAPONS["kobold-blade"], WEAPONS.sword);
    assert.deepEqual(WEAPONS["kobold-greatsword"], WEAPONS.greatsword);
  });

  test("every weapon is a worn-in-hand item of a known kind", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(ITEMS[id as keyof typeof WEAPONS].wearable.on, "hand", id);
      assert.ok(WEAPON_KINDS.includes(weapon.kind), id);
    }
  });

  test("the Basic Sword is the measure: felt 1 at average strength, by strength's factor otherwise", () => {
    assert.equal(feltHeft(WEAPONS.sword, AVERAGE_STAT), 1);
    for (const strength of [AVERAGE_STAT / 4, AVERAGE_STAT * 4]) {
      assert.equal(feltHeft(WEAPONS.sword, strength), strengthHeftFactor(strength));
    }
  });

  test("strength lightens a weapon a little, ever less, never under the floor; weakness makes it heavier", () => {
    let last = Infinity;
    for (const strength of [AVERAGE_STAT / 2, AVERAGE_STAT, 20, 40, 80, 1000, 1e9]) {
      const factor = strengthHeftFactor(strength);
      assert.ok(factor < last && factor > FELT_HEFT_FLOOR, `${strength}: ${factor}`);
      last = factor;
    }
    assert.ok(strengthHeftFactor(AVERAGE_STAT / 2) > 1);
    assert.ok(strengthHeftFactor(1e9) - FELT_HEFT_FLOOR < 1e-6);
  });

  test("one rule for every weapon and guard: heft over the Basic Sword's, × strength's factor", () => {
    const guards = [...Object.values(WEAPONS), ITEMS["wooden-shield"].shield];
    for (const guard of guards) {
      for (const strength of [1, AVERAGE_STAT / 2, AVERAGE_STAT, AVERAGE_STAT * 2, 1000]) {
        const want = (guard.heft / WEAPONS.sword.heft) * strengthHeftFactor(strength);
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
