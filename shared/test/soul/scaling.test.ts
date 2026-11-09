import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BASE_STATS, blockStaminaShare, CHAIN, CORE, CORE_STEPS, coreStats, damageTotal, essenceFactor,
  fillToFinish, grownStats, GUARDS, ITEM_IDS, itemDef, maxHpOf, newCore, physicalTakenFactor, pointsEarned,
  realmOfSteps, staminaMaxOf, STEP_NAMES, strikeCost, strikeDamage, toSteps,
  TWO_HAND_STRENGTH_FACTOR, wayStepsAfter, WEAPONS, windupTime, type ItemEffect, type Stats,
} from "@infinite-tower/shared";

const SWORD = WEAPONS.sword;
const ESSENCE_WORTHS = ITEM_IDS.flatMap((id) => {
  const effects: readonly ItemEffect[] = itemDef(id).consumable?.effects ?? [];
  return effects.flatMap((effect) => ("essence" in effect ? [effect.essence] : []));
});
const atStep = (steps: number): Stats => coreStats({ ...newCore(), steps });
const lightHit = (by: Stats, on: Stats) =>
  damageTotal(strikeDamage(SWORD, "light", 1, by)) * physicalTakenFactor(on);
const hitsToKill = (by: Stats, on: Stats) => maxHpOf(on) / lightHit(by, on);
const STEPS = Array.from({ length: CORE_STEPS }, (_, i) => i);

describe("the cost of a step, in kills", () => {
  // The player working on step n is in that step's realm, so kills are of foes grown as far as their core.
  const kills = (n: number, worth: number) => fillToFinish(n) / (worth * essenceFactor(n - 1));

  test("every kind of foe of the step's realm takes killGrowth times as many kills each step", () => {
    assert.ok(CORE.killGrowth > 1);
    for (const worth of ESSENCE_WORTHS) {
      for (let n = 2; n <= CORE_STEPS; n++) {
        const growth = kills(n, worth) / kills(n - 1, worth);
        assert.ok(Math.abs(growth - CORE.killGrowth) < 0.01, `step ${n}, worth ${worth}: ×${growth}`);
      }
    }
  });

  test("the first step is a handful of the weakest foe's kills", () => {
    const weakest = Math.min(...ESSENCE_WORTHS);
    assert.ok(kills(1, weakest) <= 6, `${kills(1, weakest)}`);
  });

  test("a foe a realm higher gives realmEssenceFactor times the essence", () => {
    assert.equal(essenceFactor(0), 1);
    assert.equal(essenceFactor(STEP_NAMES.length), CORE.realmEssenceFactor);
    assert.equal(realmOfSteps(CORE_STEPS), realmOfSteps(CORE_STEPS - 1));
  });
});

describe("each step is a clear jump", () => {
  test("against the same foe, damage dealt times HP held grows at least 15% a step", () => {
    const foe = atStep(0);
    for (const steps of STEPS) {
      const before = atStep(steps), after = atStep(steps + 1);
      const power = (s: Stats) => lightHit(s, foe) * hitsToKill(foe, s);
      assert.ok(power(after) / power(before) >= 1.15, `step ${steps + 1}: ×${power(after) / power(before)}`);
    }
  });
});

describe("equal realms fight alike at every step", () => {
  test("hits to kill an equal foe stay within 10% of the first step's", () => {
    const first = hitsToKill(BASE_STATS, BASE_STATS);
    for (const steps of [...STEPS, CORE_STEPS]) {
      const s = atStep(steps), hits = hitsToKill(s, s);
      assert.ok(Math.abs(hits / first - 1) <= 0.1, `step ${steps}: ${hits} hits, ${first} at the start`);
    }
  });

  test("blocks of an equal foe's light that one bar holds stay within 10% of the first step's", () => {
    const blocks = (s: Stats) => staminaMaxOf(s) / (lightHit(s, BASE_STATS) * blockStaminaShare(GUARDS.one, s.strength));
    const first = blocks(BASE_STATS);
    for (const steps of [...STEPS, CORE_STEPS]) {
      const ratio = blocks(atStep(steps)) / first;
      assert.ok(Math.abs(ratio - 1) <= 0.1, `step ${steps}: ×${ratio}`);
    }
  });

  test("a foe grown as far as a core has a core's stats", () => {
    for (const steps of [0, 4, CORE_STEPS]) assert.deepEqual(grownStats(BASE_STATS, steps), atStep(steps));
  });
});

describe("stamina", () => {
  test("a swing never costs more as the core grows, so the bar matters less and less", () => {
    for (const steps of STEPS) {
      const cost = (n: number) => strikeCost(SWORD, "light", atStep(n).strength);
      assert.ok(cost(steps + 1) <= cost(steps), `step ${steps + 1}`);
    }
  });
});

describe("strength quickens a swing only a little, and makes it cheaper, by half at most", () => {
  const whole = { ...newCore(), steps: CORE_STEPS };
  const allIn = coreStats({ ...whole, points: { strength: pointsEarned(whole) } }).strength;
  const strongest = allIn * TWO_HAND_STRENGTH_FACTOR;

  for (const item of ["sword", "longsword", "greatsword"] as const) {
    test(`at the strongest grip, a ${item} costs at least half its base and is at most 8% quicker`, () => {
      const weapon = WEAPONS[item], base = weapon.strikes.light.cost;
      assert.ok(strikeCost(weapon, "light", strongest) >= base / 2 - 1e-9, item);
      const at = (strike: "light" | "heavy", strength: number) =>
        wayStepsAfter(weapon, strike, windupTime(weapon, strike, "opening"), strength);
      for (const strike of ["light", "heavy"] as const) {
        const slow = at(strike, weapon.minStrength), quick = at(strike, strongest);
        assert.ok(quick.liveAt >= toSteps(CHAIN.minWindupTime));
        assert.ok(quick.liveAt >= Math.floor(slow.liveAt * 0.92), `${item} ${strike}`);
        assert.ok(quick.endAt >= Math.floor(slow.endAt * 0.92) - 1, `${item} ${strike}`);
      }
      assert.ok(at("heavy", strongest).liveAt > at("light", strongest).liveAt, item);
    });
  }
});

