import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AVERAGE_STAT, BASE_STATS, CHAIN, chainKind, DAMAGE_TYPES, feltHeft, HYBRID, MOMENTUM, momentumDamage, mirrorWay,
  physicalDamage, strikeCost, strikeDamage, STRIKES, SWING_DIRS, toSteps, wayShape, wayStepsAfter, weaponDamage,
  WEAPONS, WAYS, windupTime, type ChainKind, type Weapon,
} from "@infinite-tower/shared";

const KINDS: readonly ChainKind[] = ["opening", "reverse", "perpendicular", "other"];

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
    const { startupTime } = CHAIN;
    assert.ok(startupTime.reverse < startupTime.other && startupTime.other < startupTime.opening);
    assert.ok(startupTime.opening < startupTime.perpendicular);
    assert.equal(momentumDamage(0), 1);
    assert.equal(momentumDamage(99), MOMENTUM.maxDamage);
  });

  test("varying the line builds momentum most, the reverse least", () => {
    const { gain } = MOMENTUM;
    assert.equal(gain.opening, 0);
    assert.ok(gain.other > gain.perpendicular && gain.perpendicular > gain.reverse && gain.reverse > 0);
  });

  test("a light winds up as its chain's startup, a heavy that plus its extra, a stab its own in any chain", () => {
    for (const kind of KINDS) {
      assert.equal(windupTime("light", kind), CHAIN.startupTime[kind]);
      assert.equal(windupTime("heavy", kind), CHAIN.startupTime[kind] + HYBRID.heavy.extraTime);
      assert.equal(windupTime("stab", kind), CHAIN.stabStartupTime);
    }
  });

  test("the Basic Sword at strength 10 winds up its chain's times as they are, none flattened to the floor", () => {
    const floor = toSteps(CHAIN.minWindupTime), liveAts = new Set<number>();
    for (const kind of KINDS) {
      const liveAt = wayStepsAfter(WEAPONS.sword, windupTime("light", kind), false, AVERAGE_STAT).liveAt;
      assert.equal(liveAt, toSteps(CHAIN.startupTime[kind]), kind);
      assert.ok(liveAt >= floor, kind);
      liveAts.add(liveAt);
    }
    assert.equal(liveAts.size, KINDS.length);
    const stab = wayStepsAfter(WEAPONS.sword, windupTime("stab", "opening"), false, AVERAGE_STAT);
    assert.equal(stab.liveAt, toSteps(CHAIN.stabStartupTime));
    const light = wayStepsAfter(WEAPONS.sword, windupTime("light", "opening"), false, AVERAGE_STAT);
    assert.equal(light.liveUntil - light.liveAt, toSteps(CHAIN.activeTime));
    assert.equal(light.endAt - light.liveUntil, toSteps(CHAIN.recoverTime));
  });

  test("the Basic Sword's times and costs double at a quarter of the strength and halve at 4 times it, floored", () => {
    for (const [strength, factor] of [[AVERAGE_STAT, 1], [AVERAGE_STAT / 4, 2], [AVERAGE_STAT * 4, 0.5]] as const) {
      for (const strike of STRIKES) {
        const heavy = strike === "heavy", live = heavy ? HYBRID.heavy.activeTime : CHAIN.activeTime;
        const recover = heavy ? HYBRID.heavy.recoverTime : CHAIN.recoverTime;
        for (const kind of KINDS) {
          const what = `${strength} ${strike} ${kind}`, windup = windupTime(strike, kind);
          const steps = wayStepsAfter(WEAPONS.sword, windup, heavy, strength);
          assert.equal(steps.liveAt, toSteps(Math.max(CHAIN.minWindupTime, windup * factor)), what);
          assert.equal(steps.liveUntil - steps.liveAt, toSteps(live * factor), what);
          assert.equal(steps.endAt - steps.liveUntil, toSteps(recover * factor), what);
        }
        assert.equal(strikeCost(WEAPONS.sword, strike, strength), HYBRID[strike].cost * factor, `${strength}`);
      }
    }
  });

  test("a weapon felt under 1 winds up at the floor and is live, recovers and costs less by its felt heft", () => {
    const stick = WEAPONS["old-stick"], felt = feltHeft(stick, AVERAGE_STAT);
    assert.ok(felt < 1);
    for (const strike of STRIKES) {
      const heavy = strike === "heavy", live = heavy ? HYBRID.heavy.activeTime : CHAIN.activeTime;
      const recover = heavy ? HYBRID.heavy.recoverTime : CHAIN.recoverTime;
      for (const kind of KINDS) {
        const what = `${strike} ${kind}`, windup = windupTime(strike, kind);
        const steps = wayStepsAfter(stick, windup, heavy, AVERAGE_STAT);
        assert.equal(steps.liveAt, toSteps(Math.max(CHAIN.minWindupTime, windup * felt)), what);
        assert.equal(steps.liveUntil - steps.liveAt, toSteps(live * felt), what);
        assert.equal(steps.endAt - steps.liveUntil, toSteps(recover * felt), what);
      }
      assert.ok(strikeCost(stick, strike, AVERAGE_STAT) < HYBRID[strike].cost, strike);
      assert.equal(strikeCost(stick, strike, AVERAGE_STAT), HYBRID[strike].cost * felt, strike);
    }
  });

  test("no wind-up is ever quicker than the floor, whatever the weapon, strength or swiftness", () => {
    const floor = toSteps(CHAIN.minWindupTime);
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      for (const strength of [1, AVERAGE_STAT, AVERAGE_STAT * 2, 1000]) {
        for (const strike of STRIKES) {
          for (const kind of KINDS) {
            for (const swift of [1, 3]) {
              const steps = wayStepsAfter(weapon, windupTime(strike, kind) / swift, strike === "heavy", strength);
              assert.ok(steps.liveAt >= floor, `${id} ${strength} ${strike} ${kind} ${swift}`);
              assert.ok(steps.driveAt < steps.liveAt, `${id} ${strength} ${strike} ${kind} ${swift}`);
            }
          }
        }
      }
    }
  });

  test("a light weapon winds up quicker than the Basic Sword, down to the floor", () => {
    const stick = WEAPONS["old-stick"], liveAt = (weapon: Weapon, kind: ChainKind) =>
      wayStepsAfter(weapon, windupTime("light", kind), false, AVERAGE_STAT).liveAt;
    assert.ok(liveAt(stick, "opening") < liveAt(WEAPONS.sword, "opening"));
    assert.equal(liveAt(stick, "reverse"), toSteps(CHAIN.minWindupTime));
  });

  test("a heavy weapon stretches every part of a swing; a heavy's blade is live longer", () => {
    const sword = wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, false, AVERAGE_STAT);
    const great = wayStepsAfter(WEAPONS.greatsword, CHAIN.startupTime.opening, false, AVERAGE_STAT);
    assert.ok(great.liveAt > sword.liveAt && great.endAt > sword.endAt);
    const heavy = wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, true, AVERAGE_STAT);
    assert.ok(heavy.liveUntil - heavy.liveAt >= sword.liveUntil - sword.liveAt);
    assert.equal(strikeCost(WEAPONS.greatsword, "heavy", AVERAGE_STAT),
      HYBRID.heavy.cost * feltHeft(WEAPONS.greatsword, AVERAGE_STAT));
    assert.equal(strikeCost(WEAPONS.sword, "light", AVERAGE_STAT), HYBRID.light.cost);
  });

  test("a stronger wielder swings any weapon sooner and for less stamina; a weaker one later and for more", () => {
    for (const weapon of ["greatsword", "sword", "old-stick"] as const) {
      const steps = (strength: number) => wayStepsAfter(WEAPONS[weapon], CHAIN.startupTime.opening, false, strength);
      const weak = steps(AVERAGE_STAT / 4), average = steps(AVERAGE_STAT), strong = steps(AVERAGE_STAT * 4);
      assert.ok(weak.endAt > average.endAt && average.endAt > strong.endAt, weapon);
      const cost = (strength: number) => strikeCost(WEAPONS[weapon], "light", strength);
      assert.ok(cost(AVERAGE_STAT / 4) > cost(AVERAGE_STAT) && cost(AVERAGE_STAT) > cost(AVERAGE_STAT * 4), weapon);
    }
    const great = (strength: number) => wayStepsAfter(WEAPONS.greatsword, CHAIN.startupTime.opening, false, strength);
    for (const part of ["liveAt", "liveUntil", "endAt"] as const) {
      assert.ok(great(AVERAGE_STAT / 2)[part] > great(AVERAGE_STAT)[part], part);
      assert.ok(great(AVERAGE_STAT)[part] > great(AVERAGE_STAT * 2)[part], part);
    }
  });

  test("every swing reaches as far, verticals narrowest and horizontals widest; the stab further", () => {
    const reach = (way: (typeof WAYS)[number]) => wayShape(way, 0.8, WEAPONS.sword);
    for (const way of SWING_DIRS) assert.equal(reach(way).range, reach("lr").range, way);
    assert.ok(reach("tb").minDot > reach("tlbr").minDot && reach("tlbr").minDot > reach("lr").minDot);
    assert.ok(reach("stab").range > reach("tb").range);
  });
});

describe("a strike's damage, by type", () => {
  const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

  test("a swing deals the weapon's slash and blunt, each its own; a stab only its stab", () => {
    for (const weapon of Object.values(WEAPONS)) {
      const base = weaponDamage(weapon);
      const light = strikeDamage(weapon, "light", 1, BASE_STATS), stab = strikeDamage(weapon, "stab", 1, BASE_STATS);
      assert.deepEqual(light, { slash: base.slash, stab: 0, blunt: base.blunt });
      assert.deepEqual(stab, { slash: 0, stab: base.stab * HYBRID.stab.damageFactor, blunt: 0 });
    }
  });

  test("the stab has no flat bonus now: its own number is its damage", () => {
    assert.equal(HYBRID.stab.damageFactor, 1);
    assert.equal(HYBRID.light.damageFactor, 1);
  });

  test("a heavy deals every type of the light × its factor; power (momentum) multiplies every type", () => {
    const light = strikeDamage(WEAPONS.greatsword, "light", 1, BASE_STATS);
    const heavy = strikeDamage(WEAPONS.greatsword, "heavy", 1, BASE_STATS);
    const charged = strikeDamage(WEAPONS.greatsword, "heavy", momentumDamage(2), BASE_STATS);
    for (const type of DAMAGE_TYPES) {
      close(heavy[type], light[type] * HYBRID.heavy.damageFactor, type);
      close(charged[type], heavy[type] * momentumDamage(2), type);
    }
  });

  test("strength scales each type on its own", () => {
    const strong = { ...BASE_STATS, strength: 25 }, base = weaponDamage(WEAPONS.sword);
    const light = strikeDamage(WEAPONS.sword, "light", 1, strong);
    close(light.slash, physicalDamage(base.slash, strong), "slash");
    close(light.blunt, physicalDamage(base.blunt, strong), "blunt");
  });
});
