import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, attackShape, chainKind, isSwing, lineOf, MOMENTUM, momentumDamage, reverseOf,
  STARTER_SWORD, startupTime, SWING_DIRS, type SwingDir,
} from "@infinite-tower/shared";

describe("the ten things a sword does", () => {
  test("eight swings and a stab (blocking is held, not an attack)", () => {
    assert.equal(SWING_DIRS.length, 8);
    assert.deepEqual(ATTACK_KINDS, [...SWING_DIRS, "stab"]);
    assert.equal(isSwing("stab"), false);
    for (const dir of SWING_DIRS) assert.equal(isSwing(dir), true);
  });

  test("every swing has its reverse on the same line, and reversing twice gets it back", () => {
    for (const dir of SWING_DIRS) {
      assert.notEqual(reverseOf(dir), dir);
      assert.equal(lineOf(reverseOf(dir)), lineOf(dir), dir);
      assert.equal(reverseOf(reverseOf(dir)), dir);
    }
    assert.equal(reverseOf("lr"), "rl");
    assert.equal(reverseOf("tb"), "bt");
    assert.equal(reverseOf("tlbr"), "brtl");
    assert.equal(reverseOf("trbl"), "bltr");
  });
});

describe("chaining one swing into the next", () => {
  test("reverse on the same line, perpendicular lines, and everything else", () => {
    assert.equal(chainKind(null, "lr"), "opening");
    assert.equal(chainKind("lr", "rl"), "reverse");
    assert.equal(chainKind("tlbr", "brtl"), "reverse");
    assert.equal(chainKind("lr", "tb"), "perpendicular");
    assert.equal(chainKind("bt", "rl"), "perpendicular");
    assert.equal(chainKind("tlbr", "trbl"), "perpendicular");
    assert.equal(chainKind("bltr", "brtl"), "perpendicular");
    assert.equal(chainKind("lr", "lr"), "other");
    assert.equal(chainKind("lr", "tlbr"), "other");
    assert.equal(chainKind("tb", "bltr"), "other");
    assert.equal(chainKind("stab", "lr"), "opening");
  });

  test("every pair of swings is one of the three", () => {
    for (const a of SWING_DIRS) {
      for (const b of SWING_DIRS) assert.ok(["reverse", "perpendicular", "other"].includes(chainKind(a, b)));
    }
  });

  test("a reverse starts fastest, a perpendicular slowest, anything else in between", () => {
    const speed = STARTER_SWORD.speed;
    assert.ok(startupTime("reverse", 0, speed) < startupTime("other", 0, speed));
    assert.ok(startupTime("other", 0, speed) < startupTime("perpendicular", 0, speed));
  });


  test("momentum speeds swings up, and a faster sword starts sooner", () => {
    assert.ok(startupTime("other", MOMENTUM.max, 1) < startupTime("other", 0, 1));
    assert.ok(startupTime("other", 0, 2) < startupTime("other", 0, 1));
  });

  test("momentum raises damage up to a cap", () => {
    assert.equal(momentumDamage(0), 1);
    assert.ok(momentumDamage(1) > 1);
    assert.ok(momentumDamage(2) > momentumDamage(1));
    assert.equal(momentumDamage(MOMENTUM.max), MOMENTUM.maxDamage);
    assert.equal(momentumDamage(MOMENTUM.max * 3), MOMENTUM.maxDamage);
  });
});

describe("what each attack hits, from the sword's length", () => {
  const sword = STARTER_SWORD;
  const arc = (dir: SwingDir) => attackShape(dir, sword);

  test("horizontal swings are the widest and the shortest, vertical ones the narrowest and the longest", () => {
    for (const [h, d, v] of [["lr", "tlbr", "tb"], ["rl", "trbl", "bt"]] as const) {
      assert.ok(arc(h).minDot < arc(d).minDot && arc(d).minDot < arc(v).minDot, "wide to narrow");
      assert.ok(arc(h).range < arc(d).range && arc(d).range < arc(v).range, "short to long");
    }
  });

  test("a swing and its reverse hit the same shape", () => {
    for (const dir of SWING_DIRS) assert.deepEqual(arc(dir), arc(reverseOf(dir)));
  });

  test("the stab is a thin ray, longer than any swing", () => {
    const stab = attackShape("stab", sword);
    assert.equal(stab.shape, "ray");
    assert.ok(stab.width > 0 && stab.width < 0.5);
    for (const dir of SWING_DIRS) {
      assert.equal(arc(dir).shape, "arc");
      assert.ok(stab.range > arc(dir).range, dir);
    }
  });

  test("a longer sword reaches further with every attack", () => {
    const longer = { ...sword, length: sword.length + 0.5 };
    for (const kind of ATTACK_KINDS) {
      assert.ok(attackShape(kind, longer).range > attackShape(kind, sword).range, kind);
    }
  });
});
