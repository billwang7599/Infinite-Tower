import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFLECT_STEPS, deflectPosture, Health, maxHpOf, POSTURE, POSTURE_MOVES, WEAPONS,
} from "@infinite-tower/shared";
import { initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { FULL_HP, FULL_STAMINA, STATS } from "../../fixtures.js";
import {
  guardFrom, holding, hp, landsAt, me, play, playTo, postureOf, pressAt, pvp, stamina, type Script,
} from "./duel.js";

await initPhysics();

const PRESS = 20;
const hitAt = landsAt(PRESS);
const thrustAt = landsAt(PRESS, { perilous: "thrust" });
const sweepAt = landsAt(PRESS, { perilous: "sweep" });
const swingAt = pressAt(PRESS, { attack: "light" });
const close = (a: number, b: number, what = "") => assert.ok(Math.abs(a - b) < 1e-6, `${what} ${a} != ${b}`);
const parried = (events: FightEvent[]) => events.some((e) => e.type === "parry");
const blocked = (events: FightEvent[]) => events.some((e) => e.type === "block");

describe("Posture's deflect", () => {
  test("a guard pressed on the step a swing lands deflects it, and one the window's length before", () => {
    for (const at of [hitAt, hitAt - DEFLECT_STEPS.window]) {
      const fight = pvp();
      const events = playTo(fight, hitAt, swingAt, guardFrom(at));
      assert.ok(events.some((e) => e.type === "parry" && e.by === fight.players[1]), `pressed at ${at}`);
      assert.equal(hp(fight, 1), FULL_HP);
      assert.equal(me(fight, 0).action, "recoil");
      close(postureOf(fight, 0).value, deflectPosture(0), "attacker");
      close(postureOf(fight, 1).value, POSTURE_MOVES.swing.posture * POSTURE.deflect.takenShare, "deflector");
    }
  });

  test("pressed a step before the window and held, it's only a guard: no HP lost, the swing's posture taken", () => {
    const fight = pvp();
    const events = playTo(fight, hitAt, swingAt, guardFrom(hitAt - DEFLECT_STEPS.window - 1));
    assert.ok(blocked(events) && !parried(events));
    assert.equal(hp(fight, 1), FULL_HP);
    close(postureOf(fight, 1).value, POSTURE_MOVES.swing.posture);
    assert.equal(postureOf(fight, 0).value, 0);
  });

  test("a guard takes the posture times the attacker's heft", () => {
    const fight = pvp(holding("longsword"));
    while (!blocked(play(fight, 1, swingAt, () => ({ block: true })))) assert.ok(fight.steps < 120);
    close(postureOf(fight, 1).value, POSTURE_MOVES.swing.posture * WEAPONS.longsword.heft);
  });

  test("mashing shrinks the window: a press too soon after letting go opens a shorter one", () => {
    const late = 8;
    assert.ok(late <= DEFLECT_STEPS.window && late > DEFLECT_STEPS.window - 2 * DEFLECT_STEPS.shrink);
    const once = pvp();
    assert.ok(parried(playTo(once, hitAt, swingAt, guardFrom(hitAt - late))));
    const mashed = pvp();
    const taps: Script = (s) => ({
      block: (s >= hitAt - late - 8 && s < hitAt - late - 6) || (s >= hitAt - late - 4 && s < hitAt - late - 2)
        || s >= hitAt - late,
    });
    const events = playTo(mashed, hitAt, swingAt, taps);
    assert.ok(blocked(events) && !parried(events));
    assert.equal(me(mashed, 1).deflectWindowSteps, DEFLECT_STEPS.window - 2 * DEFLECT_STEPS.shrink);
  });

  test("a deflect sets the window back to its full length", () => {
    const fight = pvp(), taps: Script = (s) => ({ block: s === hitAt - 6 || s >= hitAt - 2 });
    playTo(fight, hitAt - 1, swingAt, taps);
    assert.equal(me(fight, 1).deflectWindowSteps, DEFLECT_STEPS.window - DEFLECT_STEPS.shrink);
    assert.ok(parried(playTo(fight, hitAt, swingAt, taps)));
    assert.equal(me(fight, 1).deflectWindowSteps, DEFLECT_STEPS.window);
  });

  test("deflects in a row give the attacker more each time", () => {
    const fight = pvp(), gap = 40, lead = hitAt - PRESS;
    const presses = [PRESS, PRESS + gap, PRESS + 2 * gap];
    const events = playTo(fight, presses.at(-1)! + lead,
      (s) => ({ attack: presses.includes(s) ? "light" : null }),
      (s) => ({ block: presses.some((p) => s >= p + lead - 3 && s < p + lead + 5) }));
    assert.equal(events.filter((e) => e.type === "parry").length, 3);
    close(postureOf(fight, 0).value, deflectPosture(0) + deflectPosture(1) + deflectPosture(2));
  });

  test("works both ways in a duel", () => {
    const fight = pvp();
    const events = playTo(fight, hitAt, guardFrom(hitAt - 3), swingAt);
    assert.ok(events.some((e) => e.type === "parry" && e.by === fight.players[0]));
    assert.equal(hp(fight, 0), FULL_HP);
  });

  test("doesn't cover the back", () => {
    const fight = pvp();
    const events = playTo(fight, hitAt, swingAt, (s) => ({ block: s >= hitAt - 2, aimZ: 1, locked: null }));
    assert.ok(!parried(events) && !blocked(events));
    assert.ok(hp(fight, 1) < FULL_HP);
  });
});

describe("Posture's hits and breaks", () => {
  test("a landed swing hurts and gives half its guarded posture", () => {
    const fight = pvp();
    playTo(fight, hitAt, swingAt);
    assert.ok(hp(fight, 1) < FULL_HP);
    close(postureOf(fight, 1).value, POSTURE_MOVES.swing.posture * POSTURE.hitShare);
  });

  test("full, it breaks: staggered, and the next weapon hit is a deathblow; posture empties", () => {
    const fight = pvp();
    postureOf(fight, 1).value = POSTURE.max - 1;
    const events = playTo(fight, hitAt, swingAt);
    assert.ok(events.some((e) => e.type === "posture" && e.what === "broken" && e.target === fight.players[1]));
    assert.equal(me(fight, 1).action, "stagger");
    close(fight.world.require(fight.players[1]!, Health).hitstun, POSTURE.broken.playerTime, "stagger");
    const before = hp(fight, 1), again = hitAt + 25;
    const blow = playTo(fight, again + (hitAt - PRESS) + 1, pressAt(again, { attack: "light" }));
    assert.ok(blow.some((e) => e.type === "posture" && e.what === "deathblow"));
    close(before - hp(fight, 1), maxHpOf(STATS) * POSTURE.broken.deathblowShare, "deathblow");
    assert.equal(postureOf(fight, 1).value, 0);
  });

  test("a break not taken leaves the posture at half when it ends", () => {
    const fight = pvp();
    postureOf(fight, 1).value = POSTURE.max - 1;
    playTo(fight, hitAt, swingAt);
    play(fight, Math.round(POSTURE.broken.playerTime * 60) + 2);
    close(postureOf(fight, 1).value, POSTURE.max * POSTURE.broken.afterShare);
  });
});

describe("Posture's perilous attacks", () => {
  test("a thrust goes through a held guard, for stamina and its damage", () => {
    const fight = pvp();
    const events = playTo(fight, thrustAt, pressAt(PRESS, { perilous: "thrust" }), () => ({ block: true }));
    assert.ok(!blocked(events));
    close(FULL_HP - hp(fight, 1), WEAPONS.sword.damage * POSTURE_MOVES.thrust.damageFactor, "damage");
    close(FULL_STAMINA - stamina(fight, 0), POSTURE_MOVES.thrust.cost, "stamina");
  });

  test("a thrust is deflected only in its own shorter window", () => {
    const inTime = pvp();
    assert.ok(parried(playTo(inTime, thrustAt, pressAt(PRESS, { perilous: "thrust" }),
      guardFrom(thrustAt - DEFLECT_STEPS.thrust))));
    const late = pvp();
    const events = playTo(late, thrustAt, pressAt(PRESS, { perilous: "thrust" }),
      guardFrom(thrustAt - DEFLECT_STEPS.thrust - 1));
    assert.ok(!parried(events));
    assert.ok(hp(late, 1) < FULL_HP);
  });

  test("Mikiri: dodging into a thrust stops on the blade, unhurt; the thrower is opened and takes posture", () => {
    const fight = pvp();
    const events = playTo(fight, thrustAt + 1, pressAt(PRESS, { perilous: "thrust" }),
      (s) => ({ dodge: s === thrustAt - 6, moveZ: s === thrustAt - 6 ? -1 : 0 }));
    assert.ok(events.some((e) => e.type === "posture" && e.what === "mikiri" && e.by === fight.players[1]));
    assert.equal(hp(fight, 1), FULL_HP);
    assert.equal(me(fight, 0).action, "stagger");
    close(postureOf(fight, 0).value, POSTURE.mikiri.posture);
  });

  test("a dodge away from a thrust only beats it", () => {
    const fight = pvp();
    const events = playTo(fight, thrustAt + 1, pressAt(PRESS, { perilous: "thrust" }),
      (s) => ({ dodge: s === thrustAt - 6, moveZ: s === thrustAt - 6 ? 1 : 0 }));
    assert.ok(!events.some((e) => e.type === "posture"));
    assert.equal(hp(fight, 1), FULL_HP);
    assert.equal(postureOf(fight, 0).value, 0);
  });

  test("a sweep goes under a guard and staggers; it passes under a jump", () => {
    const standing = pvp();
    const events = playTo(standing, sweepAt, pressAt(PRESS, { perilous: "sweep" }), () => ({ block: true }));
    assert.ok(!blocked(events));
    assert.ok(hp(standing, 1) < FULL_HP);
    assert.equal(me(standing, 1).action, "stagger");
    const jumped = pvp();
    playTo(jumped, sweepAt + 10, pressAt(PRESS, { perilous: "sweep" }), (s) => ({ jump: s >= sweepAt - 12 }));
    assert.equal(hp(jumped, 1), FULL_HP);
  });

  test("a sweep can't be deflected", () => {
    const fight = pvp();
    const events = playTo(fight, sweepAt, pressAt(PRESS, { perilous: "sweep" }), guardFrom(sweepAt));
    assert.ok(!parried(events));
    assert.ok(hp(fight, 1) < FULL_HP);
  });
});
