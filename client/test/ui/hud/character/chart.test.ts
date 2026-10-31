import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CORE_STEPS, coreAtStep, coreStats, newCore, placePoint, pointsEarned, SHOWN_STATS, type CoreState,
} from "@infinite-tower/shared";
import { chartMax, chartPoints } from "../../../../src/ui/hud/character/chart.js";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);
const length = ([x, y]: [number, number]) => Math.hypot(x, y);

describe("chartPoints (a polygon of any number of stats)", () => {
  test("the first stat points straight up, the next clockwise", () => {
    const [first, second] = chartPoints([10, 10, 10, 10], 10, 50);
    close(first![0], 0);
    close(first![1], -50);
    close(second![0], 50);
    close(second![1], 0);
  });

  for (const n of [3, 5, 7, 9]) {
    test(`${n} stats lie evenly round the circle`, () => {
      const points = chartPoints(Array<number>(n).fill(4), 4, 30);
      assert.equal(points.length, n);
      points.forEach(([x, y], i) => {
        const angle = (2 * Math.PI * i) / n;
        close(x, 30 * Math.sin(angle));
        close(y, -30 * Math.cos(angle));
      });
    });
  }

  test("a stat's distance from the centre is its share of the max, kept inside the rim", () => {
    const [half, none, over] = chartPoints([5, 0, 25], 10, 40);
    close(length(half!), 20);
    close(length(none!), 0);
    close(length(over!), 40);
  });
});

describe("chartMax (the rim: the most a stat could be at this step)", () => {
  const bare = (core: CoreState) => coreStats({ ...core, points: {} });

  test("a new core's stats all sit on the rim", () => {
    const stats = coreStats(newCore());
    for (const stat of SHOWN_STATS) assert.equal(stats[stat], chartMax(newCore()));
  });

  test("is a stat's value at the step plus every free point earned", () => {
    for (const steps of [1, 4, CORE_STEPS]) {
      const core = coreAtStep(newCore(), steps);
      assert.equal(chartMax(core), bare(core).strength + pointsEarned(core));
    }
  });

  test("doesn't move as points are placed, and every point in one stat reaches it", () => {
    let core = coreAtStep(newCore(), 3);
    const max = chartMax(core);
    for (let placed = placePoint(core, "agility"); placed; placed = placePoint(core, "agility")) {
      core = placed;
      assert.equal(chartMax(core), max);
    }
    assert.equal(coreStats(core).agility, max);
  });

  test("no shown stat is ever past it", () => {
    for (let steps = 0; steps <= CORE_STEPS; steps++) {
      let core = coreAtStep(newCore(), steps);
      for (let placed = placePoint(core, "vitality"); placed; placed = placePoint(core, "vitality")) core = placed;
      const stats = coreStats(core);
      for (const stat of SHOWN_STATS) assert.ok(stats[stat] <= chartMax(core), `${stat} at step ${steps}`);
    }
  });
});
