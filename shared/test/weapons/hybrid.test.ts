import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AVERAGE_STAT, CHAIN, chainKind, feltHeft, HYBRID, MOMENTUM, momentumDamage, mirrorWay, startupTime, strikeCost,
  SWING_DIRS, wayShape, wayStepsAfter, WEAPONS, WAYS, windupTime,
} from "@infinite-tower/shared";

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

  test("the reverse starts quickest and perpendicular slowest; momentum speeds them and adds damage, capped", () => {
    assert.ok(startupTime("reverse", 0) < startupTime("opening", 0));
    assert.ok(startupTime("perpendicular", 0) > startupTime("other", 0));
    assert.ok(startupTime("other", MOMENTUM.max) < startupTime("other", 0));
    assert.equal(startupTime("other", MOMENTUM.max + 5), startupTime("other", MOMENTUM.max));
    assert.equal(momentumDamage(0), 1);
    assert.equal(momentumDamage(99), MOMENTUM.maxDamage);
  });

  test("a light winds up as its chain's startup, a heavy that plus its extra, a stab its own in any chain", () => {
    for (const kind of ["opening", "reverse", "perpendicular", "other"] as const) {
      for (const momentum of [0, MOMENTUM.max]) {
        assert.equal(windupTime("light", kind, momentum), startupTime(kind, momentum));
        assert.equal(windupTime("heavy", kind, momentum), startupTime(kind, momentum) + HYBRID.heavy.extraTime);
        assert.equal(windupTime("stab", kind, momentum), CHAIN.stabStartupTime);
      }
    }
  });

  test("no wind-up is ever quicker than the floor, however much momentum", () => {
    for (const kind of ["opening", "reverse", "perpendicular", "other"] as const) {
      assert.ok(startupTime(kind, MOMENTUM.max) >= CHAIN.minStartupTime, kind);
    }
    assert.ok(CHAIN.stabStartupTime >= CHAIN.minStartupTime);
  });

  test("a heavy weapon stretches every part of a swing; a heavy's blade is live longer", () => {
    const sword = wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, false, AVERAGE_STAT);
    const great = wayStepsAfter(WEAPONS.greatsword, CHAIN.startupTime.opening, false, AVERAGE_STAT);
    assert.ok(great.liveAt > sword.liveAt && great.endAt > sword.endAt);
    const heavy = wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, true, AVERAGE_STAT);
    assert.ok(heavy.liveUntil - heavy.liveAt >= sword.liveUntil - sword.liveAt);
    assert.equal(strikeCost(WEAPONS.greatsword, "heavy", AVERAGE_STAT), HYBRID.heavy.cost * WEAPONS.greatsword.heft);
  });

  test("a stronger wielder swings a heavy weapon sooner and for less stamina; a weaker one later and for more", () => {
    const steps = (strength: number) => wayStepsAfter(WEAPONS.greatsword, CHAIN.startupTime.opening, false, strength);
    const weak = steps(AVERAGE_STAT / 2), average = steps(AVERAGE_STAT), strong = steps(AVERAGE_STAT * 2);
    for (const part of ["liveAt", "liveUntil", "endAt"] as const) {
      assert.ok(weak[part] > average[part] && average[part] > strong[part], part);
    }
    for (const strength of [AVERAGE_STAT / 2, AVERAGE_STAT, AVERAGE_STAT * 2]) {
      assert.equal(strikeCost(WEAPONS.greatsword, "light", strength),
        HYBRID.light.cost * feltHeft(WEAPONS.greatsword, strength), `${strength}`);
      assert.deepEqual(wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, false, strength),
        wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, false, AVERAGE_STAT), `${strength}`);
    }
  });

  test("every swing reaches as far, verticals narrowest and horizontals widest; the stab further", () => {
    const reach = (way: (typeof WAYS)[number]) => wayShape(way, 0.8, WEAPONS.sword);
    for (const way of SWING_DIRS) assert.equal(reach(way).range, reach("lr").range, way);
    assert.ok(reach("tb").minDot > reach("tlbr").minDot && reach("tlbr").minDot > reach("lr").minDot);
    assert.ok(reach("stab").range > reach("tb").range);
  });
});
