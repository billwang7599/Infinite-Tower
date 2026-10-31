import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { lineMoveSteps, ONE_STRIKE, WEAPONS } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { blade, holding, lineFrom, play, playTo, pvp, SWORD_LINE_STEPS } from "./duel.js";

await initPhysics();

describe("One Strike's lines", () => {
  test("a fight starts with every blade at the middle line, still", () => {
    const fight = pvp();
    play(fight, 2);
    for (const i of [0, 1]) {
      assert.equal(blade(fight, i).line, ONE_STRIKE.startLine);
      assert.equal(blade(fight, i).moveSteps, 0);
    }
  });

  test("a line held in the input moves the blade there, one line per move time", () => {
    const fight = pvp();
    play(fight, 1, () => ({ line: "high" }));
    assert.equal(blade(fight, 0).to, "high");
    assert.equal(blade(fight, 0).line, "middle", "still on its way");
    play(fight, SWORD_LINE_STEPS);
    assert.equal(blade(fight, 0).line, "high");
    assert.equal(blade(fight, 0).moveSteps, 0);
  });

  test("high to low is two moves, passing the middle", () => {
    const fight = pvp();
    play(fight, SWORD_LINE_STEPS + 2, () => ({ line: "high" }));
    const from = fight.steps;
    playTo(fight, from + SWORD_LINE_STEPS + 1, lineFrom(from + 1, "low"));
    assert.equal(blade(fight, 0).line, "middle");
    assert.equal(blade(fight, 0).to, "low");
    playTo(fight, from + 2 * SWORD_LINE_STEPS + 1, lineFrom(from + 1, "low"));
    assert.equal(blade(fight, 0).line, "low");
  });

  test("a heavier blade moves heft times as slowly", () => {
    const fight = pvp(holding("greatsword"));
    const steps = lineMoveSteps(WEAPONS.greatsword.heft);
    assert.ok(steps > SWORD_LINE_STEPS);
    play(fight, steps, () => ({ line: "low" }));
    assert.equal(blade(fight, 0).line, "middle");
    play(fight, 1, () => ({ line: "low" }));
    assert.equal(blade(fight, 0).line, "low");
  });

  test("no line in the input keeps the one wanted", () => {
    const fight = pvp();
    play(fight, 1, () => ({ line: "low" }));
    play(fight, SWORD_LINE_STEPS + 2, () => ({ line: null }));
    assert.equal(blade(fight, 0).line, "low");
  });
});
