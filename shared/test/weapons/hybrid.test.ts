import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BASE_STATS, CHAIN, chainKind, DAMAGE_TYPES, guardRaiseTime, ITEMS, MOMENTUM, momentumDamage, mirrorWay,
  physicalDamage, strengthDiscount, strengthTimeFactor, strikeCost, strikeDamage, STRIKES, SWING_DIRS, toSteps,
  wayShape, wayStepsAfter, WEAPONS, WAYS, windupTime, type ChainKind, type MeleeWeapon,
} from "@infinite-tower/shared";

const KINDS: readonly ChainKind[] = ["opening", "reverse", "perpendicular", "other"];
const MELEE: readonly MeleeWeapon[] = [
  WEAPONS["old-stick"], WEAPONS.sword, WEAPONS.longsword, WEAPONS.greatsword, WEAPONS["kobold-greatsword"],
];
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

describe("the sword's ways", () => {
  test("no straight upward swing: rising cuts are only the diagonals", () => {
    assert.ok(!(SWING_DIRS as readonly string[]).includes("bt"));
    assert.ok(SWING_DIRS.includes("bltr") && SWING_DIRS.includes("trbl"));
  });

  test("seen from in front, left and right swap; the top and the stab don't", () => {
    assert.equal(mirrorWay("lr"), "rl");
    assert.equal(mirrorWay("tlbr"), "trbl");
    assert.equal(mirrorWay("tb"), "tb");
    assert.equal(mirrorWay("stab"), "stab");
    for (const way of WAYS) assert.equal(mirrorWay(mirrorWay(way)), way);
  });

  test("chains: back along its line a reverse, across it perpendicular, the first or after a stab an opening", () => {
    assert.equal(chainKind(null, "lr"), "opening");
    assert.equal(chainKind("stab", "lr"), "opening");
    assert.equal(chainKind("lr", "rl"), "reverse");
    assert.equal(chainKind("tlbr", "brtl"), "reverse");
    assert.equal(chainKind("lr", "tb"), "perpendicular");
    assert.equal(chainKind("tlbr", "bltr"), "perpendicular");
    assert.equal(chainKind("lr", "tlbr"), "other");
    assert.equal(chainKind("tb", "tb"), "other");
  });

  test("the reverse starts quickest and perpendicular slowest; momentum adds damage, capped", () => {
    const share = CHAIN.windupShare;
    assert.equal(share.opening, 1);
    assert.ok(share.reverse < share.other && share.other < share.opening && share.opening < share.perpendicular);
    close(share.reverse, 0.4 / 0.56, "reverse");
    close(share.other, 0.48 / 0.56, "other");
    close(share.perpendicular, 0.6 / 0.56, "perpendicular");
    assert.equal(momentumDamage(0), 1);
    assert.equal(momentumDamage(99), MOMENTUM.maxDamage);
  });

  test("varying the line builds momentum most, the reverse least", () => {
    const { gain } = MOMENTUM;
    assert.equal(gain.opening, 0);
    assert.ok(gain.other > gain.perpendicular && gain.perpendicular > gain.reverse && gain.reverse > 0);
  });

  test("a swing winds up as its weapon's opening × its chain's share; a stab its own in any chain", () => {
    for (const weapon of MELEE) {
      for (const kind of KINDS) {
        for (const strike of ["light", "heavy"] as const) {
          close(windupTime(weapon, strike, kind), weapon.strikes[strike].windupTime * CHAIN.windupShare[kind], kind);
        }
        assert.equal(windupTime(weapon, "stab", kind), weapon.strikes.stab.windupTime);
      }
    }
  });

  test("at its minimum strength, every weapon's times are its table's, wind-ups floored", () => {
    for (const weapon of MELEE) {
      for (const strike of STRIKES) {
        const s = weapon.strikes[strike];
        for (const kind of KINDS) {
          const windup = windupTime(weapon, strike, kind), what = `${weapon.length} ${strike} ${kind}`;
          const steps = wayStepsAfter(weapon, strike, windup, weapon.minStrength);
          assert.equal(steps.liveAt, toSteps(Math.max(CHAIN.minWindupTime, windup)), what);
          assert.equal(steps.liveUntil - steps.liveAt, toSteps(s.liveTime), what);
          assert.equal(steps.endAt - steps.liveUntil, toSteps(s.recoverTime), what);
        }
      }
    }
  });

  test("strength over the minimum quickens every part of a swing by the same factor, the floor still last", () => {
    for (const weapon of MELEE) {
      for (const over of [4, 16, 40]) {
        const strength = weapon.minStrength + over, f = strengthTimeFactor(weapon, strength);
        for (const strike of STRIKES) {
          const s = weapon.strikes[strike], windup = windupTime(weapon, strike, "opening");
          const steps = wayStepsAfter(weapon, strike, windup, strength);
          assert.equal(steps.liveAt, toSteps(Math.max(CHAIN.minWindupTime, windup * f)));
          assert.equal(steps.liveUntil - steps.liveAt, toSteps(s.liveTime * f));
          assert.equal(steps.endAt - steps.liveUntil, toSteps(s.recoverTime * f));
        }
      }
    }
  });

  test("the Basic Sword's chains wind up apart, only the reverse near the floor", () => {
    const sword = WEAPONS.sword, liveAts = new Set<number>();
    for (const kind of KINDS) {
      const liveAt = wayStepsAfter(sword, "light", windupTime(sword, "light", kind), sword.minStrength).liveAt;
      assert.ok(liveAt > toSteps(CHAIN.minWindupTime) || kind === "reverse", kind);
      liveAts.add(liveAt);
    }
    assert.equal(liveAts.size, KINDS.length);
  });

  test("a strike costs its table's at the weapon's minimum strength, less for each point over, at most half off", () => {
    for (const weapon of MELEE) {
      for (const strike of STRIKES) {
        const base = weapon.strikes[strike].cost, over = weapon.minStrength + 10;
        close(strikeCost(weapon, strike, weapon.minStrength), base, strike);
        close(strikeCost(weapon, strike, over), base * strengthDiscount(weapon, over), strike);
        assert.ok(strikeCost(weapon, strike, over) < base, strike);
        close(strikeCost(weapon, strike, 1e6), base / 2, strike);
      }
    }
  });

  test("no wind-up is ever quicker than the floor, whatever the weapon, strength or swiftness", () => {
    const floor = toSteps(CHAIN.minWindupTime);
    for (const weapon of MELEE) {
      for (const strike of STRIKES) {
        for (const kind of KINDS) {
          for (const swift of [1, 3]) {
            const steps = wayStepsAfter(weapon, strike, windupTime(weapon, strike, kind) / swift, 99);
            assert.ok(steps.liveAt >= floor, `${strike} ${kind} ${swift}`);
            assert.ok(steps.driveAt < steps.liveAt, `${strike} ${kind} ${swift}`);
          }
        }
      }
    }
  });

  test("the Old Stick opens quicker than the Basic Sword, and its reverse is on the floor", () => {
    const stick = WEAPONS["old-stick"], liveAt = (weapon: MeleeWeapon, kind: ChainKind) =>
      wayStepsAfter(weapon, "light", windupTime(weapon, "light", kind), weapon.minStrength).liveAt;
    assert.ok(liveAt(stick, "opening") < liveAt(WEAPONS.sword, "opening"));
    assert.ok(liveAt(stick, "opening") > toSteps(CHAIN.minWindupTime));
    assert.equal(liveAt(stick, "reverse"), toSteps(CHAIN.minWindupTime));
  });

  test("the greatsword is slower in every part of a swing; a heavy's blade is live longer", () => {
    const at = (weapon: MeleeWeapon, strike: "light" | "heavy") =>
      wayStepsAfter(weapon, strike, windupTime(weapon, strike, "opening"), weapon.minStrength);
    const sword = at(WEAPONS.sword, "light"), great = at(WEAPONS.greatsword, "light");
    assert.ok(great.liveAt > sword.liveAt && great.endAt > sword.endAt);
    const heavy = at(WEAPONS.sword, "heavy");
    assert.ok(heavy.liveUntil - heavy.liveAt >= sword.liveUntil - sword.liveAt);
  });

  test("more grip strength over the minimum never costs more", () => {
    for (const weapon of ["greatsword", "sword", "old-stick"] as const) {
      const cost = (strength: number) => strikeCost(WEAPONS[weapon], "light", strength);
      const min = WEAPONS[weapon].minStrength;
      assert.ok(cost(min) > cost(min + 5) && cost(min + 5) > cost(min + 20), weapon);
    }
  });

  test("a guard raises in its table's time, quickened by strength over a weapon's minimum, a shield's never", () => {
    const sword = WEAPONS.sword, shield = ITEMS["wooden-shield"].shield;
    close(guardRaiseTime(sword, sword.minStrength), sword.raiseTime, "sword at its minimum");
    close(guardRaiseTime(sword, sword.minStrength + 16), sword.raiseTime * 0.92, "sword 16 over");
    close(guardRaiseTime(shield, 40), shield.raiseTime, "shield");
  });

  test("every swing reaches as far, verticals narrowest and horizontals widest; the stab further", () => {
    const reach = (way: (typeof WAYS)[number]) => wayShape(way, 0.8, WEAPONS.sword);
    for (const way of SWING_DIRS) assert.equal(reach(way).range, reach("lr").range, way);
    assert.ok(reach("tb").minDot > reach("tlbr").minDot && reach("tlbr").minDot > reach("lr").minDot);
    assert.ok(reach("stab").range > reach("tb").range);
  });
});

describe("a strike's damage, by type", () => {
  test("each strike deals its own table's damage; power (momentum) and quality multiply every type", () => {
    for (const weapon of MELEE) {
      for (const strike of STRIKES) {
        assert.deepEqual(strikeDamage(weapon, strike, 1, BASE_STATS), weapon.strikes[strike].damage);
        const charged = strikeDamage({ ...weapon, quality: 2 }, strike, momentumDamage(2), BASE_STATS);
        for (const type of DAMAGE_TYPES) {
          close(charged[type], weapon.strikes[strike].damage[type] * 2 * momentumDamage(2), type);
        }
      }
    }
  });

  test("strength scales each type on its own", () => {
    const strong = { ...BASE_STATS, strength: 25 }, base = WEAPONS.sword.strikes.light.damage;
    const light = strikeDamage(WEAPONS.sword, "light", 1, strong);
    close(light.slash, physicalDamage(base.slash, strong), "slash");
    close(light.blunt, physicalDamage(base.blunt, strong), "blunt");
  });
});
