import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CHAIN, chainKind, COUNTER_PARRY, HYBRID, MOMENTUM, momentumDamage, mirrorWay, parryShare, reverseOf, startupTime,
  strikeCost, SWING_DIRS, wayShape, wayStepsAfter, WEAPONS, WAYS,
} from "@infinite-tower/shared";

describe("the sword's ways", () => {
  test("a swing's reverse goes back along its line, twice is itself", () => {
    for (const dir of SWING_DIRS) {
      assert.notEqual(reverseOf(dir), dir);
      assert.equal(reverseOf(reverseOf(dir)), dir);
    }
  });

  test("seen from in front, left and right swap; up and down and the stab don't", () => {
    assert.equal(mirrorWay("lr"), "rl");
    assert.equal(mirrorWay("tlbr"), "trbl");
    assert.equal(mirrorWay("tb"), "tb");
    assert.equal(mirrorWay("stab"), "stab");
    for (const way of WAYS) assert.equal(mirrorWay(mirrorWay(way)), way);
  });

  test("a swing parries the one it meets head-on, either 45° neighbour for a share; a stab only a stab", () => {
    assert.equal(parryShare("lr", "rl"), 1);
    assert.equal(parryShare("tlbr", "rl"), COUNTER_PARRY.offAngleShare);
    assert.equal(parryShare("bltr", "rl"), COUNTER_PARRY.offAngleShare);
    assert.equal(parryShare("brtl", "lr"), COUNTER_PARRY.offAngleShare);
    assert.equal(parryShare("tb", "rl"), 0);
    assert.equal(parryShare("rl", "rl"), 0);
    assert.equal(parryShare("stab", "stab"), 1);
    assert.equal(parryShare("stab", "lr"), 0);
    assert.equal(parryShare("lr", "stab"), 0);
  });

  test("chains: back along its line a reverse, across it perpendicular, the first or after a stab an opening", () => {
    assert.equal(chainKind(null, "lr"), "opening");
    assert.equal(chainKind("stab", "lr"), "opening");
    assert.equal(chainKind("lr", "rl"), "reverse");
    assert.equal(chainKind("lr", "tb"), "perpendicular");
    assert.equal(chainKind("tlbr", "bltr"), "perpendicular");
    assert.equal(chainKind("lr", "tlbr"), "other");
  });

  test("the reverse starts quickest and perpendicular slowest; momentum speeds them and adds damage, capped", () => {
    assert.ok(startupTime("reverse", 0) < startupTime("opening", 0));
    assert.ok(startupTime("perpendicular", 0) > startupTime("other", 0));
    assert.ok(startupTime("other", MOMENTUM.max) < startupTime("other", 0));
    assert.equal(startupTime("other", MOMENTUM.max + 5), startupTime("other", MOMENTUM.max));
    assert.equal(momentumDamage(0), 1);
    assert.equal(momentumDamage(99), MOMENTUM.maxDamage);
  });

  test("a heavy weapon stretches every part of a swing; a heavy's blade is live longer", () => {
    const sword = wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, false);
    const great = wayStepsAfter(WEAPONS.greatsword, CHAIN.startupTime.opening, false);
    assert.ok(great.liveAt > sword.liveAt && great.endAt > sword.endAt);
    const heavy = wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, true);
    assert.ok(heavy.liveUntil - heavy.liveAt >= sword.liveUntil - sword.liveAt);
    assert.equal(strikeCost(WEAPONS.greatsword, "heavy"), HYBRID.heavy.cost * WEAPONS.greatsword.heft);
  });

  test("verticals reach furthest and narrowest, horizontals widest; the stab furthest of all", () => {
    const reach = (way: (typeof WAYS)[number]) => wayShape(way, 0.8, WEAPONS.sword);
    assert.ok(reach("tb").range > reach("lr").range && reach("tb").minDot > reach("lr").minDot);
    assert.ok(reach("stab").range > reach("tb").range);
  });
});
