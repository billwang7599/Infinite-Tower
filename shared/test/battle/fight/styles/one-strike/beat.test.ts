import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { beatCost, ONE_STRIKE, toSteps, WEAPONS } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { FULL_STAMINA } from "../../fixtures.js";
import {
  blade, both, holding, hp, lineFrom, maxHp, me, play, playTo, pressAt, pvp, stamina, swingOf, SWORD_LINE_STEPS,
} from "./duel.js";

await initPhysics();

const AT = 20;
const beat = pressAt(AT, { attack: "heavy" });
const BEAT_STEPS = toSteps(ONE_STRIKE.beat.windupTime);
const landed = AT + BEAT_STEPS + 1;

describe("One Strike's beat", () => {
  test("right click beats a blade holding your line aside: off line for a while, for its stamina", () => {
    const fight = pvp();
    const events = playTo(fight, landed, beat);
    assert.equal(me(fight, 0).action, "none", "free again as it lands");
    assert.ok(events.some((e) => e.type === "strike" && e.what === "beat" && e.target === fight.players[1]));
    assert.ok(blade(fight, 1).offLineSteps > 0 && blade(fight, 1).offLineSteps <= toSteps(ONE_STRIKE.beat.offLineTime));
    assert.equal(blade(fight, 0).offLineSteps, 0);
    assert.equal(stamina(fight, 0), FULL_STAMINA - beatCost(WEAPONS.sword));
  });

  test("off line, the blade can't thrust or change line; then it's back where it was", () => {
    const fight = pvp();
    playTo(fight, landed, beat);
    play(fight, 2, () => ({}), () => ({ attack: "light", line: "high" }));
    assert.equal(swingOf(fight, 1), null);
    assert.equal(blade(fight, 1).line, "middle");
    assert.equal(blade(fight, 1).moveSteps, 0);
    play(fight, toSteps(ONE_STRIKE.beat.offLineTime) + SWORD_LINE_STEPS + 2, () => ({}), () => ({ line: "high" }));
    assert.equal(blade(fight, 1).line, "high");
  });

  test("a thrust at a blade knocked off line lands", () => {
    const fight = pvp();
    playTo(fight, landed, beat);
    play(fight, 40, pressAt(landed + 1, { attack: "light" }));
    assert.ok(hp(fight, 1) < maxHp(fight, 1));
  });

  test("if their line changed before it lands, you're thrown off line yourself", () => {
    const fight = pvp();
    const events = playTo(fight, landed, beat, lineFrom(AT + 1, "high"));
    assert.ok(blade(fight, 0).offLineSteps > 0);
    assert.ok(blade(fight, 0).offLineSteps <= toSteps(ONE_STRIKE.beat.missOffLineTime));
    assert.equal(blade(fight, 1).offLineSteps, 0);
    assert.ok(events.some((e) => e.type === "strike" && e.what === "offLine" && e.target === fight.players[0]));
  });

  test("out of reach, you're thrown off line yourself", () => {
    const fight = pvp({}, { at: { x: 0, y: 0.05, z: 5 } });
    playTo(fight, landed, beat);
    assert.ok(blade(fight, 0).offLineSteps > 0);
  });

  test("the reach is the shorter of the two blades'", () => {
    const at = (z: number) => pvp(holding("greatsword"), { at: { x: 0, y: 0.05, z } });
    const far = at(3.1), near = at(2.6);
    playTo(far, landed + 8, beat);
    playTo(near, landed + 8, beat);
    assert.ok(blade(far, 0).offLineSteps > 0 && blade(far, 1).offLineSteps === 0, "past the sword's reach");
    assert.ok(blade(near, 1).offLineSteps > 0 && blade(near, 0).offLineSteps === 0);
  });

  test("a beat landing in a thrust's wind-up knocks it aside", () => {
    const fight = pvp();
    playTo(fight, AT + 40, pressAt(AT + 2, { attack: "heavy" }), both(pressAt(AT, { attack: "light" })));
    assert.equal(hp(fight, 0), maxHp(fight, 0));
  });
});
