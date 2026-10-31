import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BREAKS, breakerOf, guardMoveSteps, MASTER_CUTS, STANCES, WEAPONS } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { FULL_STAMINA } from "../../fixtures.js";
import {
  both, cuts, holding, landsAfter, play, playTo, pressAt, pvp, SETTLED, stamina, stanceFrom, swingOf,
} from "./duel.js";

await initPhysics();

describe("Master Cuts' guards", () => {
  test("each breaks one and is broken by one; the opposite pairs are even", () => {
    assert.deepEqual(new Set(Object.values(BREAKS)), new Set(STANCES));
    for (const s of STANCES) {
      assert.notEqual(BREAKS[s], s);
      assert.equal(BREAKS[breakerOf(s)], s);
      assert.notEqual(BREAKS[BREAKS[s]], s, "no pair breaks each other");
    }
    assert.equal(BREAKS["vom-tag"], "alber");
    assert.equal(BREAKS.alber, "ochs");
    assert.equal(BREAKS.ochs, "pflug");
    assert.equal(BREAKS.pflug, "vom-tag");
  });

  test("a fight starts in Vom Tag", () => {
    const fight = pvp();
    play(fight, 1);
    assert.equal(cuts(fight, 0).to, MASTER_CUTS.startStance);
    assert.equal(cuts(fight, 0).moveSteps, 0);
  });

  test("changing guard takes its time, with no guard while moving, for its stamina", () => {
    const fight = pvp();
    play(fight, 10);
    playTo(fight, 11, stanceFrom(11, "ochs"));
    assert.equal(cuts(fight, 0).to, "ochs");
    assert.ok(cuts(fight, 0).moveSteps > 0, "moving");
    assert.equal(stamina(fight, 0), FULL_STAMINA - MASTER_CUTS.guard.cost);
    playTo(fight, 10 + guardMoveSteps(WEAPONS.sword.heft, false), stanceFrom(11, "ochs"));
    assert.ok(cuts(fight, 0).moveSteps > 0, "still moving a step before");
    playTo(fight, 11 + guardMoveSteps(WEAPONS.sword.heft, false), stanceFrom(11, "ochs"));
    assert.equal(cuts(fight, 0).moveSteps, 0);
  });

  test("a heavier blade moves its guard slower", () => {
    assert.ok(guardMoveSteps(WEAPONS.greatsword.heft, false) > guardMoveSteps(WEAPONS.sword.heft, false));
    const fight = pvp(holding("greatsword"));
    playTo(fight, 11, stanceFrom(11, "alber"));
    assert.equal(cuts(fight, 0).moveSteps, guardMoveSteps(WEAPONS.greatsword.heft, false));
  });

  test("with the blade out the guard waits, then moves in the recovery, quicker", () => {
    const fight = pvp(), at = SETTLED, live = landsAfter("strike", "vom-tag");
    const a = both(pressAt(at, { attack: "light" }), stanceFrom(at + live, "pflug"));
    playTo(fight, at + live, a);
    assert.equal(cuts(fight, 0).to, "vom-tag", "live: no change");
    const liveUntil = swingOf(fight, 0)!.liveUntil;
    playTo(fight, at + liveUntil, a);
    assert.equal(cuts(fight, 0).to, "pflug");
    assert.equal(cuts(fight, 0).moveSteps, guardMoveSteps(WEAPONS.sword.heft, true) - 1);
  });

  test("a guard can't attack while it moves: the press waits for it", () => {
    const fight = pvp(), moved = SETTLED + guardMoveSteps(WEAPONS.sword.heft, false);
    const a = both(stanceFrom(SETTLED, "pflug"), pressAt(SETTLED + 1, { attack: "light" }));
    playTo(fight, moved, a);
    assert.equal(swingOf(fight, 0), null);
    playTo(fight, moved + 1, a);
    assert.equal(swingOf(fight, 0)?.stance, "pflug");
  });
});
