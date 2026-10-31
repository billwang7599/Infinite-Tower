import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Body, landedCutSteps, ONE_STRIKE, PLAYER, strikeSteps, thrustCost, toSteps, WEAPONS, type Line,
} from "@infinite-tower/shared";
import { initPhysics, type Fight, type FightEvent } from "@infinite-tower/shared/fight";
import { FULL_STAMINA, STATS } from "../../fixtures.js";
import {
  blade, both, GAP_M, hp, lineFrom, maxHp, me, play, playTo, pressAt, pvp, stamina, swingOf, SWORD_THRUST_STEPS,
} from "./duel.js";

await initPhysics();

const AT = 20;
const thrust = pressAt(AT, { attack: "light" });
const lands = AT + SWORD_THRUST_STEPS;
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

function thrustAt(theirs: Line, mine: Line = "middle", fight = pvp()): { fight: Fight; events: FightEvent[] } {
  const events = playTo(fight, lands + 2, both(lineFrom(1, mine), thrust), lineFrom(1, theirs));
  return { fight, events };
}

describe("One Strike's thrust", () => {
  test("left click thrusts at your line, wound up as the table says, for its stamina", () => {
    const fight = pvp();
    playTo(fight, AT, both(lineFrom(1, "high"), thrust));
    const swing = swingOf(fight, 0)!;
    assert.equal(swing.line, "high");
    assert.equal(swing.liveAt, strikeSteps(WEAPONS.sword.heft, "thrust").liveAt);
    assert.equal(stamina(fight, 0), FULL_STAMINA - thrustCost(WEAPONS.sword));
  });

  test("at the line the target's blade holds, facing it, it's stopped: a clash, both pushed apart", () => {
    const { fight, events } = thrustAt("middle");
    assert.equal(hp(fight, 1), maxHp(fight, 1));
    assert.ok(events.some((e) => e.type === "strike" && e.what === "clash" && e.target === fight.players[1]));
    assert.equal(me(fight, 0).action, "recoil");
    assert.equal(swingOf(fight, 0), null);
    const a = fight.world.require(fight.players[0]!, Body), b = fight.world.require(fight.players[1]!, Body);
    assert.ok(a.vel.z < 0 && b.vel.z > 0, "pushed apart");
  });

  test("at any other line it lands, for the zone's share of their most HP", () => {
    const cases = [["high", "middle", 0.6], ["middle", "low", 0.2], ["low", "high", 1]] as const;
    for (const [theirs, mine, share] of cases) {
      const { fight, events } = thrustAt(theirs, mine);
      assert.ok(close(maxHp(fight, 1) - hp(fight, 1), maxHp(fight, 1) * share), `${mine} at ${theirs}`);
      assert.equal(share, ONE_STRIKE.zones.person[mine]);
      assert.ok(events.some((e) => e.type === "hit" && e.target === fight.players[1] && e.weapon));
    }
  });

  test("strength and the weapon's damage don't count", () => {
    const { fight } = thrustAt("high", "middle", pvp({ stats: { ...STATS, strength: 40 } }));
    assert.ok(close(maxHp(fight, 1) - hp(fight, 1), maxHp(fight, 1) * ONE_STRIKE.zones.person.middle));
  });

  test("a low thrust lames: walking at half pace, no dodge, no jump, for the rest of the fight", () => {
    const { fight } = thrustAt("high", "low");
    play(fight, 60);
    play(fight, 30, () => ({}), () => ({ moveX: 1 }));
    const vel = fight.world.require(fight.players[1]!, Body).vel;
    assert.ok(Math.abs(Math.abs(vel.x) - PLAYER.moveSpeed * ONE_STRIKE.lameMoveFactor) < 0.05, `${vel.x}`);
    play(fight, 2, () => ({}), () => ({ dodge: true }));
    assert.notEqual(me(fight, 1).action, "dodge");
    play(fight, 5, () => ({}), () => ({ jump: true }));
    assert.ok(me(fight, 1).grounded);
  });

  test("inside the point (closer than half the blade) it can't hit", () => {
    const fight = pvp({}, { at: { x: 0, y: 0.05, z: 0.75 } });
    playTo(fight, lands + 2, thrust, lineFrom(1, "high"));
    assert.equal(hp(fight, 1), maxHp(fight, 1));
  });

  test("a thrust that lands recovers sooner than one that hits nothing", () => {
    const landed = thrustAt("high").fight, missed = pvp({}, { at: { x: 0, y: 0.05, z: GAP_M + 6 } });
    playTo(missed, lands + 2, thrust);
    const recovery = (f: Fight) => swingOf(f, 0)!.endAt - swingOf(f, 0)!.liveUntil;
    assert.equal(recovery(missed), toSteps(ONE_STRIKE.thrust.missRecoverTime));
    assert.equal(recovery(landed), recovery(missed) - landedCutSteps(WEAPONS.sword.heft));
  });

  test("two thrusts whose blades are out at once both land: a double", () => {
    const fight = pvp();
    playTo(fight, lands + 2, both(lineFrom(1, "high"), thrust), both(lineFrom(1, "low"), thrust));
    assert.ok(hp(fight, 0) < maxHp(fight, 0));
    assert.ok(hp(fight, 1) < maxHp(fight, 1));
  });

  test("one landing first stops the other's wind-up", () => {
    const fight = pvp();
    const late = pressAt(AT + 8, { attack: "light" });
    playTo(fight, lands + 30, both(lineFrom(1, "high"), thrust), both(lineFrom(1, "low"), late));
    assert.ok(hp(fight, 1) < maxHp(fight, 1));
    assert.equal(hp(fight, 0), maxHp(fight, 0));
  });

  test("pressed while the blade moves, it waits for it to arrive and goes at the new line", () => {
    const fight = pvp();
    playTo(fight, AT, lineFrom(AT, "low"));
    play(fight, 1, () => ({ attack: "light", line: "low" }));
    assert.equal(swingOf(fight, 0), null);
    play(fight, 10, () => ({ line: "low" }));
    assert.equal(swingOf(fight, 0)?.line, "low");
    assert.equal(blade(fight, 0).line, "low");
  });

  test("the thruster steps in while the blade is out", () => {
    const fight = pvp({}, { at: { x: 0, y: 0.05, z: GAP_M + 6 } });
    playTo(fight, lands + 1, thrust);
    const vel = fight.world.require(fight.players[0]!, Body).vel;
    assert.ok(Math.abs(vel.z - ONE_STRIKE.thrust.stepInSpeed) < 1e-3, `${vel.z}`);
  });
});
