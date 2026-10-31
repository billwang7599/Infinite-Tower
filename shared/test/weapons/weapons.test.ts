import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, ATTACKS, attackCost, attackDamage, attackShape, attackSteps, BASE_STATS, blocks, COMBAT, FIXED_DT,
  GUARD_SIDES, ITEMS, mirrorSide, PLAYER, WEAPON_KINDS, weaponIn, weaponItemIn, WEAPONS, type Weapon,
} from "@infinite-tower/shared";

const sword = WEAPONS.sword;
const near = (steps: number, seconds: number, what: string) =>
  assert.ok(Math.abs(steps * FIXED_DT - seconds) <= FIXED_DT / 2, `${what}: ${steps} steps, not ${seconds} s`);

describe("guards: three sides, as the one holding them sees them", () => {
  test("left, top and right; light and heavy attacks", () => {
    assert.deepEqual(GUARD_SIDES, ["left", "top", "right"]);
    assert.deepEqual(ATTACK_KINDS, ["light", "heavy"]);
  });

  test("facing each other, one's left is the other's right, and top is top", () => {
    assert.equal(mirrorSide("left"), "right");
    assert.equal(mirrorSide("right"), "left");
    assert.equal(mirrorSide("top"), "top");
  });

  test("a guard blocks only an attack from the side it faces: the attacker's left by its right", () => {
    for (const guard of GUARD_SIDES) {
      for (const from of GUARD_SIDES) assert.equal(blocks(guard, from), guard === mirrorSide(from), `${guard}/${from}`);
      assert.equal(blocks(null, guard), false, "no guard blocks nothing");
    }
  });
});

describe("an attack's timing: fixed per kind and weapon, the same every time", () => {
  test("with the sword, a light goes live its land time after the press, a heavy its own", () => {
    for (const kind of ATTACK_KINDS) near(attackSteps(sword, kind, 0).liveAt, ATTACKS[kind].landTime, kind);
    assert.ok(attackSteps(sword, "heavy", 0).liveAt > attackSteps(sword, "light", 0).liveAt);
  });

  test("live, then recovering, each for its table time", () => {
    for (const kind of ATTACK_KINDS) {
      const s = attackSteps(sword, kind, 0), a = ATTACKS[kind];
      near(s.liveUntil - s.liveAt, a.liveTime, `${kind} live`);
      near(s.endAt - s.liveUntil, a.recoverTime, `${kind} recovery`);
      assert.ok(s.driveAt > 0 && s.driveAt < s.liveAt, `${kind}: drawn back, then driven`);
    }
  });

  test("chained, an attack lands its chain time after it starts", () => {
    for (const kind of ATTACK_KINDS) {
      for (let chain = 1; chain < COMBAT.maxChain; chain++) {
        near(attackSteps(sword, kind, chain).liveAt, ATTACKS[kind].chainLandTime, `${kind} #${chain + 1}`);
      }
    }
  });

  test("a heavier weapon is slower by its heft, a fixed number; the same weapon is never quicker or slower", () => {
    for (const weapon of Object.values(WEAPONS) as Weapon[]) {
      for (const kind of ATTACK_KINDS) {
        near(attackSteps(weapon, kind, 0).liveAt, ATTACKS[kind].landTime * weapon.heft, `${kind}`);
        assert.deepEqual(attackSteps(weapon, kind, 0), attackSteps(weapon, kind, 0));
      }
    }
    const ladder = [WEAPONS.sword, WEAPONS.longsword, WEAPONS.greatsword];
    for (let i = 1; i < ladder.length; i++) assert.ok(ladder[i]!.heft > ladder[i - 1]!.heft);
  });

  test("a quicker swing (an Air Imbue) shortens the wind-up only", () => {
    const quick = attackSteps(sword, "light", 0, 2), plain = attackSteps(sword, "light", 0);
    near(quick.liveAt, ATTACKS.light.landTime / 2, "wind-up");
    assert.equal(quick.liveUntil - quick.liveAt, plain.liveUntil - plain.liveAt);
  });
});

describe("what an attack deals and costs", () => {
  test("the weapon's damage for a light, the heavy's factor more, at the base stats; no other variance", () => {
    for (const weapon of Object.values(WEAPONS) as Weapon[]) {
      assert.equal(attackDamage(weapon, "light", BASE_STATS), weapon.damage);
      assert.equal(attackDamage(weapon, "heavy", BASE_STATS), weapon.damage * ATTACKS.heavy.damageFactor);
    }
  });

  test("strength adds by its square root, as every physical hit does", () => {
    const strong = { ...BASE_STATS, strength: 4 * BASE_STATS.strength };
    assert.equal(attackDamage(sword, "light", strong), sword.damage * 2);
  });

  test("stamina: the kind's cost, times the weapon's heft", () => {
    for (const kind of ATTACK_KINDS) {
      assert.equal(attackCost(sword, kind), ATTACKS[kind].cost);
      assert.equal(attackCost(WEAPONS.greatsword, kind), ATTACKS[kind].cost * WEAPONS.greatsword.heft);
    }
  });
});

describe("what each attack hits, from the wielder's arm and the sword's length", () => {
  const arm = PLAYER.armReachM;

  test("from a side, wide and short; from the top, narrow and long", () => {
    const side = attackShape("left", arm, sword), top = attackShape("top", arm, sword);
    assert.ok(side.minDot < top.minDot, "wider");
    assert.ok(top.range > side.range, "longer");
    assert.deepEqual(attackShape("right", arm, sword), side);
  });

  test("a longer sword reaches further from every side", () => {
    for (const side of GUARD_SIDES) {
      assert.ok(attackShape(side, arm, WEAPONS.greatsword).range > attackShape(side, arm, sword).range, side);
    }
  });

  test("a longer arm reaches as much further as the same length more of blade", () => {
    const longer = { ...sword, length: sword.length + 0.5 };
    for (const side of GUARD_SIDES) {
      assert.deepEqual(attackShape(side, arm + 0.5, sword), attackShape(side, arm, longer), side);
    }
  });
});

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
