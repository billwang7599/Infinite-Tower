import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, attackShape, followingBlade, isSwing, ITEMS, lineOf, liveStep, planSwing, PLAYER, restingBlade,
  reverseOf, SCREEN_DIR, stoppedBlade, strokeOf, SWING, SWING_DIRS, WEAPON_KINDS, weaponIn, weaponItemIn, WEAPONS,
  type AttackKind, type SwingData, type SwingDir, type SwingPlan, type Weapon,
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
  const opening = (attack: AttackKind, weapon: Weapon = sword, strength = STRENGTH) =>
    planSwing(weapon, strength, restingBlade(), attack);
  // The next swing on the step the last one lets go: its blade on its far side, still at its impact speed.
  const after = (first: AttackKind, next: AttackKind, weapon: Weapon = sword, strength = STRENGTH) =>
    planSwing(weapon, strength, followingBlade(first, opening(first, weapon, strength).flow), next);
  const fromRest = SWING.setTime + SWING.driveTime;

  test("the starter sword at strength 10, from rest: set to the swing's start, then driven to impact", () => {
    for (const dir of SWING_DIRS) {
      close(opening(dir).windupTime, fromRest, `opening ${dir}`);
      close(opening(dir).driveTime, SWING.driveTime, `drive ${dir}`);
      assert.equal(opening(dir).startSpeed, 0);
      assert.equal(opening(dir).timeFactor, 1);
      assert.equal(opening(dir).momentum, 1, "the starter's own momentum");
    }
  });

  test("on the blade's way it loops round and is quickest; a reverse brakes first; across it brakes and sets", () => {
    for (const [first, reverse, across, neighbour] of [
      ["lr", "rl", "tb", "tlbr"], ["tb", "bt", "rl", "trbl"], ["tlbr", "brtl", "trbl", "lr"],
    ] as const) {
      const t = (next: AttackKind) => after(first, next).windupTime;
      assert.ok(t(first) < 0.6 * fromRest, `${first}: the same again is clearly quicker than from rest`);
      assert.ok(t(first) < t(neighbour) && t(neighbour) < t(reverse), `${first}: then its neighbour, then reverse`);
      assert.ok(t(reverse) > fromRest, `${first}: braking first, a reverse is slower than from rest`);
      assert.ok(t(across) > t(reverse), `${first}: across is slowest`);
      close(t(reverse), SWING.driveTime * opening(first).flow + SWING.driveTime, `${first}: brake, then drive`);
    }
  });

  test("a heavier blade takes far longer to brake for a reverse", () => {
    const braking = (w: Weapon) => after("lr", "rl", w).windupTime - opening("rl", w).driveTime;
    assert.ok(braking(WEAPONS.greatsword) > 2.5 * braking(sword));
  });

  test("a blade come to rest on its far side reverses with a drive alone", () => {
    close(planSwing(sword, STRENGTH, followingBlade("lr", 0), "rl").windupTime, SWING.driveTime, "reverse");
  });

  test("flow: speed carried into the new swing's way makes it hit harder, up to the cap; a reverse gets none", () => {
    assert.equal(opening("lr").flow, 1);
    close(after("lr", "lr").flow, SWING.maxFlow, "the same again");
    assert.ok(after("lr", "tlbr").flow > 1 && after("lr", "tlbr").flow < SWING.maxFlow, "its neighbour, some");
    assert.equal(after("lr", "tb").flow, 1, "across");
    assert.equal(after("lr", "rl").flow, 1, "reverse");
    close(after("lr", "lr").momentum, SWING.maxFlow, "momentum with it");
    const third = planSwing(sword, STRENGTH, followingBlade("lr", after("lr", "lr").flow), "lr");
    close(third.flow, SWING.maxFlow, "never past the cap");
  });

  test("effort: every drive costs an opening's, and braking the blade costs on top", () => {
    close(opening("lr").effort, 1, "opening");
    close(after("lr", "lr").effort, 1, "a flowing swing brakes nothing");
    close(after("lr", "rl").effort, 1 + SWING.brakeEffort, "a reverse brakes the whole blade");
    assert.ok(after("lr", "tb").effort > after("lr", "tlbr").effort, "across brakes more than its neighbour");
    assert.ok(after("lr", "tlbr").effort > after("lr", "lr").effort, "its neighbour brakes some");
  });

  test("a stab brakes the blade, sets it back at the guard, draws back, thrusts and leaves the blade at the guard", () => {
    const fromGuard = SWING.stabDrawTime + SWING.driveTime;
    close(opening("stab").windupTime, fromGuard, "from the guard it only draws back");
    for (const first of SWING_DIRS) {
      const left = planSwing(sword, STRENGTH, followingBlade(first, 0), "stab");
      close(left.windupTime, SWING.setTime + fromGuard, `left still on ${first}'s far side: set back as far as a swing`);
      const stab = after(first, "stab");
      close(stab.windupTime, SWING.driveTime * opening(first).flow + SWING.setTime + fromGuard, first);
      assert.equal(stab.flow, 1);
    }
    const near = planSwing(sword, STRENGTH, { ...followingBlade("lr", 0), x: 0.25 }, "stab").windupTime;
    assert.ok(opening("stab").windupTime < near && near < SWING.setTime + fromGuard, "nearer the guard, sooner");
    const great = WEAPONS.greatsword, far = planSwing(great, STRENGTH, followingBlade("lr", 0), "stab");
    close(far.windupTime, (SWING.setTime + fromGuard) * far.timeFactor, "a heavier blade, as much slower");
    assert.deepEqual(followingBlade("stab", 1), restingBlade());
    assert.ok(after("lr", "stab").effort > opening("stab").effort, "braking a moving blade costs more");
    close(after("stab", "lr").windupTime, fromRest, "a swing after a stab is an opening");
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

  test("a longer blade is harder to turn, at the same mass and balance", () => {
    assert.ok(opening("lr", { ...sword, length: sword.length * 2 }).windupTime > opening("lr").windupTime);
  });

  test("the follow-through brakes the blade from its impact speed: longer the heavier it is", () => {
    close(opening("lr").followTime, SWING.driveTime, "the starter's");
    close(after("lr", "lr").followTime, SWING.driveTime * SWING.maxFlow, "a faster blade runs on longer");
    assert.ok(opening("lr", WEAPONS.greatsword).followTime > 2.5 * opening("lr").followTime);
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

  test("the blade lets go on its swing's far side, moving its way at the speed given", () => {
    for (const dir of SWING_DIRS) {
      const blade = followingBlade(dir, 1.2), way = SCREEN_DIR[dir];
      close(blade.x, way.x, dir);
      close(blade.y, way.y, dir);
      close(blade.vx * way.x + blade.vy * way.y, 1.2, dir);
    }
  });
});

describe("a swing's stroke: what the fight runs is what's drawn", () => {
  const swingOf = (plan: SwingPlan, step: number): SwingData => {
    const liveAt = liveStep(plan.windupTime), liveUntil = liveAt + liveStep(SWING.activeTime * plan.timeFactor);
    return {
      attack: "lr", dir: { x: 0, z: 1 }, step, driveAt: liveAt - liveStep(plan.driveTime), liveAt, liveUntil,
      letGoAt: liveUntil, endAt: liveUntil + liveStep(plan.followTime), startSpeed: plan.startSpeed,
      flow: plan.flow, damage: 9, knockback: 0, lift: 0, poiseDamage: 0, momentum: plan.momentum, stoppedAt: null,
    };
  };
  const plan = planSwing(WEAPONS.sword, 10, restingBlade(), "lr");
  const at = (step: number, p = plan) => strokeOf(swingOf(p, step));
  const { driveAt, liveAt, liveUntil, endAt } = swingOf(plan, 0);

  test("set first, then driven from rest: at half the drive it's gone a quarter of the way (angle ∝ t²)", () => {
    assert.ok(at(0).set === 0 && at(driveAt - 1).set < 1 && at(driveAt - 1).turn === 0, "set, not yet turning");
    const half = at(driveAt + (liveAt - driveAt) / 2).turn, live = at(liveAt).turn;
    assert.ok(Math.abs(half / live - 0.25) < 0.02, `${half} of ${live}`);
  });

  test("fastest at impact: each step turns more until the blade is live, then the follow-through slows it", () => {
    const turned = (step: number) => at(step + 1).turn - at(step).turn;
    for (let step = driveAt; step < liveAt - 1; step++) assert.ok(turned(step + 1) > turned(step), `step ${step}`);
    for (let step = liveUntil; step < endAt - 1; step++) assert.ok(turned(step + 1) < turned(step), `step ${step}`);
    assert.ok(turned(liveAt) > turned(driveAt) * 5, "far faster at impact than as it starts");
  });

  test("from rest, a half-turn: a third driving, a third live, a third following through", () => {
    assert.ok(Math.abs(at(liveAt).turn - 1 / 3) < 0.01);
    assert.ok(Math.abs(at(liveUntil).turn - 2 / 3) < 0.01);
    assert.ok(Math.abs(at(endAt).turn - 1) < 0.01);
    assert.ok(at(endAt).follow === 1 && at(liveUntil).follow === 0);
  });

  test("a swing flowing on the blade's way starts the drive already moving", () => {
    const flowing = planSwing(WEAPONS.sword, 10, followingBlade("lr", 1), "lr");
    const s = swingOf(flowing, 0), quarter = s.driveAt + (s.liveAt - s.driveAt) / 4;
    assert.ok(at(quarter, flowing).turn / at(s.liveAt, flowing).turn > 0.2, "not the slow start from rest");
  });
});

describe("a blade stopped mid-swing", () => {
  const plan = planSwing(WEAPONS.sword, 10, restingBlade(), "lr");
  const liveAt = liveStep(plan.windupTime), liveUntil = liveAt + liveStep(SWING.activeTime * plan.timeFactor);
  const swingOf = (attack: AttackKind, step: number, stoppedAt: number | null = null): SwingData => ({
    attack, dir: { x: 0, z: 1 }, step, driveAt: liveAt - liveStep(plan.driveTime), liveAt, liveUntil,
    letGoAt: liveUntil, endAt: liveUntil + liveStep(plan.followTime), startSpeed: plan.startSpeed, flow: plan.flow,
    damage: 9, knockback: 0, lift: 0, poiseDamage: 0, momentum: plan.momentum, stoppedAt,
  });
  const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

  test("is held still on its swing's line: at its start before it turns, through the guard, to its far end", () => {
    for (const dir of SWING_DIRS) {
      const way = SCREEN_DIR[dir], { endAt } = swingOf(dir, 0);
      const start = stoppedBlade(swingOf(dir, 0)), end = stoppedBlade(swingOf(dir, endAt));
      close(start.x, -way.x, `${dir} start x`);
      close(start.y, -way.y, `${dir} start y`);
      close(end.x, way.x, `${dir} end x`);
      close(end.y, way.y, `${dir} end y`);
      for (let step = 0; step <= endAt; step++) {
        const blade = stoppedBlade(swingOf(dir, step)), along = blade.x * way.x + blade.y * way.y;
        assert.equal(blade.vx === 0 && blade.vy === 0, true, `${dir} still`);
        close(blade.x, along * way.x, `${dir} on its line`);
        close(blade.y, along * way.y, `${dir} on its line`);
      }
    }
  });

  test("halfway round, it's at the guard; a stab's always is", () => {
    const half = Array.from({ length: 200 }, (_, step) => swingOf("lr", step))
      .find((swing) => strokeOf(swing).turn >= 0.5)!;
    assert.ok(Math.abs(stoppedBlade(half).x) < 0.1, `${stoppedBlade(half).x}`);
    assert.deepEqual(stoppedBlade(swingOf("stab", liveAt)), restingBlade());
  });

  test("stopped on a step, its stroke goes no further while the swing runs on", () => {
    const stoppedAt = liveAt + 1, later = swingOf("lr", liveUntil + 3, stoppedAt);
    assert.deepEqual(strokeOf(later), strokeOf(swingOf("lr", stoppedAt)));
    assert.deepEqual(stoppedBlade(later), stoppedBlade(swingOf("lr", stoppedAt)));
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

  test("sword, longsword, greatsword: each longer and heavier, slower to start and reverse, harder hitting, dearer",
    () => {
      const ladder = [WEAPONS.sword, WEAPONS.longsword, WEAPONS.greatsword];
      const opening = (w: Weapon) => planSwing(w, 10, restingBlade(), "lr");
      const reverse = (w: Weapon) => planSwing(w, 10, followingBlade("lr", 1), "rl");
      for (let i = 1; i < ladder.length; i++) {
        const lighter = ladder[i - 1]!, heavier = ladder[i]!;
        assert.ok(heavier.length > lighter.length && heavier.mass > lighter.mass, `${i}`);
        assert.ok(opening(heavier).windupTime > opening(lighter).windupTime, `${i}: opening`);
        assert.ok(reverse(heavier).windupTime > reverse(lighter).windupTime, `${i}: reverse`);
        assert.ok(opening(heavier).momentum > opening(lighter).momentum, `${i}: hit`);
        assert.ok(opening(heavier).effort > opening(lighter).effort, `${i}: stamina`);
      }
      assert.ok(opening(WEAPONS.greatsword).timeFactor < SWING.maxTimeFactor, "the greatsword is slow, not too heavy");
      const perSecond = (w: Weapon) => (w.damage * opening(w).momentum) / opening(w).timeFactor;
      for (const w of ladder) {
        const ratio = perSecond(w) / perSecond(WEAPONS.sword);
        assert.ok(ratio > 0.95 && ratio < 1.05, `about the sword's damage per second: ${ratio}`);
      }
    });

  test("the Kobold Greatsword's blade is a greatsword that hits like the Kobold's", () => {
    const { kind, length, mass, balanceM } = WEAPONS.greatsword;
    assert.deepEqual({ ...WEAPONS["kobold-greatsword"], damage: WEAPONS["kobold-blade"].damage },
      { kind, length, mass, balanceM, damage: WEAPONS["kobold-blade"].damage });
  });

  test("every weapon is a worn-in-hand item of a known kind, as heavy as the item", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      assert.equal(ITEMS[id as keyof typeof WEAPONS].wornOn, "hand", id);
      assert.ok(WEAPON_KINDS.includes(weapon.kind), id);
      assert.equal(weapon.mass, ITEMS[id as keyof typeof WEAPONS].weight, id);
    }
  });
});
