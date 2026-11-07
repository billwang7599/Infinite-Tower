import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  absorb, BASE_STATS, CORE, CORE_STEPS, coreAfterDeath, coreAtStep, coreName, coreStats, coreWhole, fillToFinish,
  HIDDEN_STATS, keptCore, newCore, placePoint, pointsEarned, pointsLeft, REALMS, SHOWN_STATS, STEP_NAMES,
  takeBackPoint, type CoreState,
} from "@infinite-tower/shared";

const at = (steps: number, fill = 0, points: CoreState["points"] = {}): CoreState =>
  ({ steps, fill, points, inscriptions: [] });
const realmOf = (step: number) => Math.floor((step - 1) / STEP_NAMES.length);

describe("the ladder", () => {
  test("5 realms of 3 steps: Early Yan first, Peak Tian last", () => {
    assert.equal(CORE_STEPS, REALMS.length * STEP_NAMES.length);
    assert.equal(coreName(newCore()), `${STEP_NAMES[0]} ${REALMS[0]}`);
    assert.equal(coreName(at(1)), `${STEP_NAMES[1]} ${REALMS[0]}`);
    assert.equal(coreName(at(STEP_NAMES.length)), `${STEP_NAMES[0]} ${REALMS[1]}`);
    assert.equal(coreName(at(CORE_STEPS - 1)), `${STEP_NAMES.at(-1)} ${REALMS.at(-1)}`);
  });

  test("a new core is Early Yan with nothing in it", () => {
    assert.deepEqual(newCore(), { steps: 0, fill: 0, points: {}, inscriptions: [] });
  });

  test("the first step takes the first fill, and each step's fill grows", () => {
    assert.equal(fillToFinish(1), CORE.firstFill);
    assert.equal(fillToFinish(2), Math.round(CORE.killGrowth * CORE.firstFill));
    for (let n = 2; n <= CORE_STEPS; n++) assert.ok(fillToFinish(n) > fillToFinish(n - 1), `step ${n}`);
    assert.ok(Number.isInteger(fillToFinish(2)));
  });
});

describe("absorb", () => {
  test("essence goes into the fill", () => {
    assert.deepEqual(absorb(newCore(), 20), at(0, 20));
  });

  test("a full fill breaks through to the next step, the rest carried into it", () => {
    assert.deepEqual(absorb(at(0, fillToFinish(1) - 5), 20), at(1, 15));
    const twoSteps = fillToFinish(1) + fillToFinish(2);
    assert.deepEqual(absorb(newCore(), twoSteps + 1), at(2, 1));
  });

  test("the last step finished, the core is whole and takes no more", () => {
    const whole = absorb(at(CORE_STEPS - 1), fillToFinish(CORE_STEPS) + 50);
    assert.deepEqual(whole, at(CORE_STEPS, 0));
    assert.ok(coreWhole(whole));
    assert.ok(!coreWhole(at(CORE_STEPS - 1)));
  });

  test("keeps the placed points", () => {
    assert.deepEqual(absorb(at(1, 0, { vitality: 2 }), 10).points, { vitality: 2 });
  });
});

describe("coreStats", () => {
  test("a new core has every stat at its base", () => {
    assert.deepEqual(coreStats(newCore()), BASE_STATS);
  });

  test("each step adds its realm's gain to every shown stat, doubling each realm", () => {
    for (const steps of [1, 3, 4, 7, CORE_STEPS]) {
      let gain = 0;
      for (let n = 1; n <= steps; n++) gain += CORE.firstRealmGain * CORE.realmFactor ** realmOf(n);
      const stats = coreStats(at(steps));
      for (const stat of SHOWN_STATS) assert.equal(stats[stat], BASE_STATS[stat] + gain, `${stat} at ${steps}`);
    }
  });

  test("the hidden stats go up the same amount every step, in every realm", () => {
    for (const steps of [1, 4, CORE_STEPS]) {
      const stats = coreStats(at(steps));
      for (const stat of HIDDEN_STATS) assert.equal(stats[stat], BASE_STATS[stat] + steps * CORE.hiddenGain, stat);
    }
  });

  test("placed points add to their stat", () => {
    const stats = coreStats(at(2, 0, { strength: 3, defense: 1 }));
    const plain = coreStats(at(2));
    assert.equal(stats.strength, plain.strength + 3);
    assert.equal(stats.defense, plain.defense + 1);
    assert.equal(stats.agility, plain.agility);
  });
});

describe("free points", () => {
  test("each step gives its realm's points, doubling each realm", () => {
    assert.equal(pointsEarned(newCore()), 0);
    assert.equal(pointsEarned(at(1)), CORE.firstRealmPoints);
    const firstRealm = STEP_NAMES.length * CORE.firstRealmPoints;
    assert.equal(pointsEarned(at(STEP_NAMES.length + 1)), firstRealm + CORE.firstRealmPoints * CORE.realmFactor);
  });

  test("placed one at a time, while any are left", () => {
    let core: CoreState | null = at(1);
    for (let i = 0; i < CORE.firstRealmPoints; i++) core = placePoint(core!, "strength");
    assert.deepEqual(core!.points, { strength: CORE.firstRealmPoints });
    assert.equal(pointsLeft(core!), 0);
    assert.equal(placePoint(core!, "agility"), null);
  });

  test("taken back one at a time, only from a stat that has some", () => {
    const core = at(1, 0, { strength: 1 });
    assert.deepEqual(takeBackPoint(core, "strength"), at(1, 0, {}));
    assert.equal(takeBackPoint(core, "agility"), null);
  });

  test("never into a hidden stat", () => {
    assert.equal(placePoint(at(1), "toughness" as never), null);
  });
});

describe("coreAfterDeath", () => {
  test("loses the fill inside the step", () => {
    assert.deepEqual(coreAfterDeath(at(4, 30, { vitality: 1 })), at(4, 0, { vitality: 1 }));
  });

  test("with the fill already empty, a whole step, back across a realm too", () => {
    assert.deepEqual(coreAfterDeath(at(4)), at(3));
    assert.equal(coreName(coreAfterDeath(at(STEP_NAMES.length))), `${STEP_NAMES.at(-1)} ${REALMS[0]}`);
  });

  test("Early Yan with nothing in it has nothing to lose", () => {
    assert.deepEqual(coreAfterDeath(newCore()), newCore());
  });

  test("the lost step's points come back off the stats with the most placed", () => {
    const earned = pointsEarned(at(3)), lost = earned - pointsEarned(at(2));
    const after = coreAfterDeath(at(3, 0, { strength: earned - 1, vitality: 1 }));
    assert.equal(after.steps, 2);
    assert.deepEqual(after.points, { strength: earned - 1 - lost, vitality: 1 });
  });
});

describe("coreAtStep", () => {
  test("that many steps done, the fill empty, the points fitted", () => {
    assert.deepEqual(coreAtStep(at(1, 40), 2), at(2));
    assert.deepEqual(coreAtStep(at(1, 0, { strength: 2 }), 0), at(0));
    assert.deepEqual(coreAtStep(newCore(), -1), newCore());
    assert.deepEqual(coreAtStep(newCore(), CORE_STEPS + 3), at(CORE_STEPS));
  });
});

describe("keptCore", () => {
  test("a good save is kept as it is", () => {
    assert.deepEqual(keptCore(at(3, 10, { strength: 2 })), at(3, 10, { strength: 2 }));
  });

  test("anything out of range is brought back into it", () => {
    assert.deepEqual(keptCore({ steps: 99, fill: 5, points: {} }), at(CORE_STEPS));
    assert.deepEqual(keptCore({ steps: -2, fill: -5, points: {} }), at(0));
    assert.deepEqual(keptCore({ steps: 1.5, fill: 2.5, points: {} }), at(1, 2));
    assert.deepEqual(keptCore({ steps: 0, fill: fillToFinish(1) + 9, points: {} }), at(0, fillToFinish(1) - 1));
  });

  test("points only in shown stats, whole and not negative, and no more than earned", () => {
    const points = { strength: 1.5, toughness: 4, agility: -1, nonsense: 2 } as never;
    assert.deepEqual(keptCore({ steps: 1, fill: 0, points }), at(1, 0, { strength: 1 }));
    assert.equal(pointsLeft(keptCore({ steps: 1, fill: 0, points: { strength: 50 } })), 0);
  });
});
