import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  canWield, coreStats, DAMAGE_TYPES, ITEMS, newCore, STRENGTH_DISCOUNT, STRENGTH_QUICKENING, strengthDiscount,
  strengthTimeFactor, STRIKES, WEAPON_KINDS, weaponDamage, weaponIn, weaponItemIn, WEAPONS, type Damage,
  type MeleeWeapon,
} from "@infinite-tower/shared";

const swingOf = (damage: Damage) => damage.slash + damage.blunt;
const SWORDS = ["sword", "kobold-blade", "longsword", "greatsword", "kobold-greatsword"] as const;
const MELEE = ["old-stick", ...SWORDS] as const;
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

describe("the arsenal", () => {
  test("a weapon in either hand is found, the right hand's first; other things in hand are no weapon", () => {
    assert.equal(weaponItemIn({ rightHand: "skillbook", leftHand: "sword" }), "sword");
    assert.equal(weaponItemIn({ rightHand: "kobold-blade", leftHand: "sword" }), "kobold-blade");
    assert.equal(weaponItemIn({ rightHand: "skillbook", leftHand: null }), null);
    assert.equal(weaponIn({ rightHand: null, leftHand: "kobold-blade" }), WEAPONS["kobold-blade"]);
  });

  test("sword, longsword, greatsword: each longer, slower to start, dearer and harder swinging", () => {
    const ladder: MeleeWeapon[] = [WEAPONS.sword, WEAPONS.longsword, WEAPONS.greatsword];
    for (let i = 1; i < ladder.length; i++) {
      const lighter = ladder[i - 1]!, heavier = ladder[i]!;
      assert.ok(heavier.length > lighter.length);
      assert.ok(heavier.minStrength > lighter.minStrength);
      for (const strike of STRIKES) {
        assert.ok(heavier.strikes[strike].windupTime > lighter.strikes[strike].windupTime, strike);
        assert.ok(heavier.strikes[strike].cost > lighter.strikes[strike].cost, strike);
        assert.ok(heavier.strikes[strike].poiseDamage > lighter.strikes[strike].poiseDamage, strike);
      }
      assert.ok(swingOf(heavier.strikes.light.damage) > swingOf(lighter.strikes.light.damage));
      assert.ok(heavier.raiseTime > lighter.raiseTime);
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

  test("every melee strike has its own wind-up, live time, recovery, cost, damage and poise damage", () => {
    for (const id of MELEE) {
      const weapon = WEAPONS[id];
      for (const strike of STRIKES) {
        const s = weapon.strikes[strike];
        for (const n of [s.windupTime, s.liveTime, s.recoverTime, s.cost, s.poiseDamage]) assert.ok(n > 0, id);
        assert.ok(damageOf(s.damage) > 0, `${id} ${strike}`);
      }
      assert.ok(weapon.whiffRecoverTime > 0 && weapon.feintRecoverTime > 0 && weapon.parryWeight > 0, id);
    }
  });

  test("the Old Stick is quick, cheap and feeble, yet no strike opens on the floor or is all but free", () => {
    const stick = WEAPONS["old-stick"], sword = WEAPONS.sword;
    for (const strike of STRIKES) {
      const s = stick.strikes[strike], b = sword.strikes[strike];
      assert.ok(s.windupTime < b.windupTime && s.windupTime > 0.4, strike);
      assert.ok(s.cost < b.cost && s.cost >= b.cost / 3, strike);
      assert.ok(damageOf(s.damage) < damageOf(b.damage), strike);
      assert.ok(s.liveTime >= 0.1 && s.recoverTime >= 0.05, strike);
    }
  });

  test("the shield raises as quick as the Basic Sword; the bow is drawn by its own table", () => {
    assert.equal(ITEMS["wooden-shield"].shield.raiseTime, WEAPONS.sword.raiseTime);
    const bow = WEAPONS["training-bow"];
    assert.ok(bow.draw.minTime < bow.draw.fullTime && bow.draw.cost > 0);
  });

  test("strength over a weapon's minimum takes 1.5% a point off its costs, at most half, never adding any", () => {
    const sword = WEAPONS.sword, at = (over: number) => strengthDiscount(sword, sword.minStrength + over);
    assert.equal(STRENGTH_DISCOUNT.perPoint, 0.015);
    assert.equal(STRENGTH_DISCOUNT.max, 0.5);
    assert.equal(at(0), 1);
    assert.equal(at(-3), 1);
    close(at(4), 0.94, "4 over");
    close(at(20), 0.7, "20 over");
    assert.equal(at(1000), 0.5);
    close(strengthDiscount({ minStrength: 6 }, 10), 0.94, "min 6");
  });

  test("strength over a weapon's minimum makes its times 0.5% a point quicker, at most 8%, never slower", () => {
    const sword = WEAPONS.sword, at = (over: number) => strengthTimeFactor(sword, sword.minStrength + over);
    assert.equal(STRENGTH_QUICKENING.perPoint, 0.005);
    assert.equal(STRENGTH_QUICKENING.max, 0.08);
    assert.equal(at(0), 1);
    assert.equal(at(-5), 1);
    close(at(4), 0.98, "4 over");
    close(at(16), 0.92, "16 over");
    close(at(1000), 0.92, "far over");
    assert.equal(strengthTimeFactor({}, 50), 1, "no minimum, as a shield: never quickened");
  });

  test("a weapon can be wielded from its minimum strength up, not below", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(canWield(id as keyof typeof WEAPONS, weapon.minStrength), true, id);
      if (weapon.minStrength > 0) assert.equal(canWield(id as keyof typeof WEAPONS, weapon.minStrength - 1), false, id);
    }
    assert.ok(WEAPONS.sword.minStrength > WEAPONS["old-stick"].minStrength);
  });

  test("a new player can wield the Old Stick and the Basic Sword in one hand", () => {
    const strength = coreStats(newCore()).strength;
    assert.ok(canWield("old-stick", strength) && canWield("sword", strength), `${strength}`);
  });
});

const damageOf = (damage: Damage) => damage.slash + damage.stab + damage.blunt;

describe("a weapon's damage, by type", () => {
  test("a swing deals slash and blunt only, a stab only stab, each in whole numbers; a heavy twice a light", () => {
    for (const id of MELEE) {
      const { light, heavy, stab } = WEAPONS[id].strikes;
      for (const type of DAMAGE_TYPES) {
        for (const s of [light, heavy, stab]) assert.ok(Number.isInteger(s.damage[type]), `${id} ${type}`);
        assert.equal(heavy.damage[type], 2 * light.damage[type], `${id} ${type}`);
      }
      assert.equal(light.damage.stab, 0, id);
      assert.deepEqual({ slash: stab.damage.slash, blunt: stab.damage.blunt }, { slash: 0, blunt: 0 }, id);
    }
  });

  test("its damage shown is the light's swing and the stab's stab", () => {
    const sword = WEAPONS.sword;
    assert.deepEqual(weaponDamage(sword), {
      slash: sword.strikes.light.damage.slash, blunt: sword.strikes.light.damage.blunt,
      stab: sword.strikes.stab.damage.stab,
    });
  });

  test("every current weapon is of quality 1, and quality multiplies the whole of it", () => {
    for (const weapon of Object.values(WEAPONS)) assert.equal(weapon.quality ?? 1, 1);
    const better = weaponDamage({ ...WEAPONS.greatsword, quality: 2 }), plain = weaponDamage(WEAPONS.greatsword);
    for (const type of DAMAGE_TYPES) assert.equal(better[type], 2 * plain[type], type);
  });

  test("a sword cuts more than it bludgeons and stabs well below its swing", () => {
    for (const id of SWORDS) {
      const damage = weaponDamage(WEAPONS[id]);
      assert.ok(damage.slash > damage.blunt && damage.blunt > 0, id);
      assert.ok(damage.stab > 0 && damage.stab < 0.75 * swingOf(damage), `${id}: ${damage.stab}`);
    }
  });

  test("the longsword is the thrusting sword, the greatsword the bluntest and the poorest stabber for its size", () => {
    const share = (id: (typeof SWORDS)[number]) => {
      const d = weaponDamage(WEAPONS[id]);
      return { stab: d.stab / swingOf(d), blunt: d.blunt / swingOf(d) };
    };
    assert.ok(share("longsword").stab > share("sword").stab && share("sword").stab > share("greatsword").stab);
    assert.ok(share("greatsword").blunt > share("sword").blunt);
  });

  test("the old stick has no edge: a blunt swing and a weak poke", () => {
    const damage = weaponDamage(WEAPONS["old-stick"]);
    assert.equal(damage.slash, 0);
    assert.ok(damage.blunt > 0 && damage.stab > 0 && damage.stab < damage.blunt);
  });

  test("a bow's arrow is all stab", () => {
    const damage = weaponDamage(WEAPONS["training-bow"]);
    assert.ok(damage.stab > 0 && damage.slash === 0 && damage.blunt === 0);
  });
});
