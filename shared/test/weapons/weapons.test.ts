import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, attackShape, isSwing, ITEMS, lineOf, planSwing, PLAYER, restingBlade, reverseOf, SCREEN_DIR, SWING,
  SWING_DIRS, WEAPON_KINDS, weaponIn, weaponItemIn, WEAPONS, type AttackKind, type SwingDir, type Weapon,
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

describe("inertia: a swing's timing, speed and cost come from where the blade is and how it moves", () => {
  const sword = WEAPONS.sword, STRENGTH = 10;
  const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);
  const after = (first: AttackKind, next: AttackKind, weapon: Weapon = sword, strength = STRENGTH) =>
    planSwing(weapon, strength, planSwing(weapon, strength, restingBlade(), first).blade, next);
  const opening = (attack: AttackKind, weapon: Weapon = sword, strength = STRENGTH) =>
    planSwing(weapon, strength, restingBlade(), attack);

  test("the starter sword at strength 10: an opening swing and a reverse take the times they're tuned to", () => {
    for (const dir of SWING_DIRS) {
      close(opening(dir).windupTime, SWING.openingTime, `opening ${dir}`);
      close(after(dir, reverseOf(dir)).windupTime, SWING.reverseTime, `${dir} reversed`);
      assert.equal(opening(dir).timeFactor, 1);
      assert.equal(opening(dir).momentum, 1, "the starter's own momentum");
    }
  });

  test("the reverse is quickest, then across the line, and the same swing again or its neighbour slowest", () => {
    for (const [first, reverse, across, neighbour] of [
      ["lr", "rl", "tb", "tlbr"], ["tb", "bt", "rl", "trbl"], ["tlbr", "brtl", "trbl", "lr"],
    ] as const) {
      const t = (next: AttackKind) => after(first, next).windupTime;
      assert.ok(t(reverse) < t(across), `${first}: reverse before across`);
      assert.ok(t(across) < t(neighbour), `${first}: across before its neighbour`);
      assert.ok(t(neighbour) < t(first), `${first}: its neighbour before the same again`);
      assert.ok(t(across) > SWING.openingTime, `${first}: across is slower than from rest`);
    }
  });

  test("flow: speed carried into the new swing's way makes it hit harder, up to the cap; a reverse gets none", () => {
    assert.equal(opening("lr").flow, 1);
    close(after("lr", "lr").flow, SWING.maxFlow, "the same again");
    assert.ok(after("lr", "tlbr").flow > 1 && after("lr", "tlbr").flow < SWING.maxFlow, "its neighbour, some");
    assert.equal(after("lr", "tb").flow, 1, "across");
    assert.equal(after("lr", "rl").flow, 1, "reverse");
    close(after("lr", "lr").momentum, SWING.maxFlow, "momentum with it");
    const third = planSwing(sword, STRENGTH, after("lr", "lr").blade, "lr");
    close(third.flow, SWING.maxFlow, "never past the cap");
  });

  test("effort: what a swing adds to the blade's motion, braking too; the opening swing is the unit", () => {
    close(opening("lr").effort, 1, "opening");
    close(after("lr", "lr").effort, 1, "a flowing swing adds no more than an opening one");
    assert.ok(after("lr", "rl").effort > after("lr", "tb").effort, "a reverse brakes the whole follow-through");
    assert.ok(after("lr", "tb").effort > after("lr", "lr").effort, "across, it brakes some");
  });

  test("a stab draws back for its own time from wherever the blade is, and leaves it at rest", () => {
    for (const first of [...SWING_DIRS, "stab"] as const) {
      const stab = after(first, "stab");
      close(stab.windupTime, SWING.stabTime, `stab after ${first}`);
      assert.equal(stab.flow, 1);
      assert.deepEqual(stab.blade, restingBlade());
    }
    close(opening("stab").windupTime, SWING.stabTime, "from rest");
    assert.ok(after("lr", "stab").effort > opening("stab").effort, "braking a moving blade costs more");
    close(after("stab", "lr").windupTime, SWING.openingTime, "a swing after a stab is an opening");
  });

  test("a heavier weapon swings slower but hits harder: the same damage per second", () => {
    const heavy = { ...sword, mass: sword.mass * 2 };
    for (const [first, next] of [["lr", "rl"], ["lr", "tb"], ["tb", "tb"]] as const) {
      close(after(first, next, heavy).windupTime, after(first, next).windupTime * Math.SQRT2, `${first} ${next}`);
      const perSecond = (w: Weapon) => after(first, next, w).momentum / after(first, next, w).timeFactor;
      close(perSecond(heavy), perSecond(sword), `${first} ${next}`);
    }
    assert.ok(opening("lr", heavy).momentum > opening("lr").momentum);
  });

  test("strength mostly speeds the swing, and adds a little to its hit", () => {
    const strong = opening("lr", sword, STRENGTH * 2);
    close(strong.timeFactor, 1 / Math.SQRT2, "time");
    close(strong.momentum, Math.sqrt(Math.SQRT2), "momentum: double strength is +19%");
  });

  test("swing times scale no further than the clamp; too heavy a weapon costs more instead", () => {
    const anvil = { ...sword, mass: sword.mass * 100 }, feather = { ...sword, mass: sword.mass / 100 };
    assert.equal(opening("lr", anvil).timeFactor, SWING.maxTimeFactor);
    assert.equal(opening("lr", feather).timeFactor, SWING.minTimeFactor);
    assert.ok(opening("lr", anvil).effort > opening("lr", { ...sword, mass: sword.mass * 2 }).effort);
  });

  test("the blade ends each swing on its far side, still moving its way", () => {
    for (const dir of SWING_DIRS) {
      const { blade } = opening(dir), way = SCREEN_DIR[dir];
      close(blade.x, way.x, dir);
      close(blade.y, way.y, dir);
      assert.ok(blade.vx * way.x + blade.vy * way.y > 0, dir);
    }
  });
});

describe("what each attack hits, from the wielder's arm and the sword's length", () => {
  const sword = WEAPONS.sword, arm = PLAYER.armReachM;
  const arc = (dir: SwingDir) => attackShape(dir, arm, sword);

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
    const stab = attackShape("stab", arm, sword);
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
      assert.ok(attackShape(kind, arm, longer).range > attackShape(kind, arm, sword).range, kind);
    }
  });

  test("a longer arm reaches as much further as the same length more of blade", () => {
    const longer = { ...sword, length: sword.length + 0.5 };
    for (const kind of ATTACK_KINDS) {
      assert.deepEqual(attackShape(kind, arm + 0.5, sword), attackShape(kind, arm, longer), kind);
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

  test("every weapon is a worn-in-hand item of a known kind, as heavy as the item", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(ITEMS[id as keyof typeof WEAPONS].wornOn, "hand", id);
      assert.ok(WEAPON_KINDS.includes(weapon.kind), id);
      assert.equal(weapon.mass, ITEMS[id as keyof typeof WEAPONS].weight, id);
    }
  });
});
