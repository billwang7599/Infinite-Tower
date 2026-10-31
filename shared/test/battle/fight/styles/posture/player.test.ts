import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Body, POSTURE, POSTURE_MOVES, toSteps, WEAPONS, Wielder } from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { FULL_HP, FULL_STAMINA } from "../../fixtures.js";
import { GAP_M, hp, landsAt, me, play, playTo, postureOf, pressAt, pvp, stamina } from "./duel.js";

await initPhysics();

const PRESS = 5;
const swingOf = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Wielder).swing;

describe("Posture's swings", () => {
  test("left click swings from the top, wound up as the table says, at no stamina", () => {
    const fight = pvp();
    play(fight, PRESS, pressAt(PRESS, { attack: "light" }));
    const swing = swingOf(fight, 0)!;
    assert.equal(swing.side, "top");
    assert.equal(swing.perilous, null);
    assert.equal(swing.liveAt, toSteps(POSTURE_MOVES.swing.windupTime));
    assert.equal(stamina(fight, 0), FULL_STAMINA);
  });

  test("a swing started in the last one's recovery chains, quicker; the fourth is the finisher, then a new string", () => {
    const fight = pvp(), starts: number[] = [], kinds: string[] = [];
    let held = false;
    while (starts.length < 5 && fight.steps < 600) {
      const swing = swingOf(fight, 0);
      const press: boolean = !held && (swing === null || swing.step >= swing.liveUntil);
      held = press;
      play(fight, 1, () => ({ attack: press ? "light" : null, aimZ: -1, locked: null }));
      const now = swingOf(fight, 0);
      if (now && now.step === 1) {
        starts.push(now.chain);
        kinds.push(`${now.attack} ${now.liveAt}`);
      }
    }
    assert.deepEqual(starts, [0, 1, 2, 3, 0]);
    assert.deepEqual(kinds, [
      `light ${toSteps(POSTURE_MOVES.swing.windupTime)}`, `light ${toSteps(POSTURE.chainWindupTime)}`,
      `light ${toSteps(POSTURE.chainWindupTime)}`, `heavy ${toSteps(POSTURE_MOVES.finisher.windupTime)}`,
      `light ${toSteps(POSTURE_MOVES.swing.windupTime)}`,
    ]);
  });

  test("held right click guards (the hybrid's block action); let go, it ends", () => {
    const fight = pvp();
    play(fight, 5, () => ({}), () => ({ block: true }));
    assert.equal(me(fight, 1).action, "block");
    play(fight, 1);
    assert.equal(me(fight, 1).action, "none");
  });

  test("a heavy attack, a guard side, a way and a guard break do nothing in Posture", () => {
    const fight = pvp();
    play(fight, PRESS, pressAt(PRESS, { attack: "heavy", guard: "left", way: "lr", guardBreak: true, kick: true }));
    assert.equal(swingOf(fight, 0), null);
    assert.equal(me(fight, 0).guard, null);
    assert.equal(me(fight, 0).action, "none");
  });
});

describe("Posture's perilous attacks", () => {
  test("a thrust and a sweep cost stamina and wind up as the table says", () => {
    for (const kind of ["thrust", "sweep"] as const) {
      const fight = pvp();
      play(fight, PRESS, pressAt(PRESS, { perilous: kind }));
      const swing = swingOf(fight, 0)!;
      assert.equal(swing.perilous, kind);
      assert.equal(swing.liveAt, toSteps(POSTURE_MOVES[kind].windupTime));
      assert.equal(swing.posture, POSTURE_MOVES[kind].posture * WEAPONS.sword.heft);
      assert.ok(stamina(fight, 0) < stamina(fight, 1));
    }
  });

  test("a jump kick off a sweeper: posture and a stagger, no damage, and a bounce", () => {
    const sweepAt = landsAt(PRESS, { perilous: "sweep" });
    const fight = pvp();
    playTo(fight, sweepAt + 2, pressAt(PRESS, { perilous: "sweep" }), (s) => ({ jump: s >= sweepAt - 12 }));
    assert.equal(hp(fight, 1), FULL_HP);
    const events = play(fight, 1, () => ({}), () => ({ attack: "light" }));
    assert.ok(events.some((e) => e.type === "posture" && e.what === "jumpKick" && e.target === fight.players[0]));
    assert.equal(hp(fight, 0), FULL_HP);
    assert.equal(postureOf(fight, 0).value, POSTURE.jumpKick.posture);
    assert.equal(me(fight, 0).action, "stagger");
    assert.ok(fight.world.require(fight.players[1]!, Body).vel.y > 0);
  });

  test("a click in the air with no sweeper near is just a swing", () => {
    const fight = pvp({}, { at: { x: 0, y: 0.05, z: GAP_M + 4 } });
    play(fight, 6, (s) => ({ jump: true, attack: s === 6 ? "light" : null }));
    assert.ok(!me(fight, 0).grounded);
    assert.equal(swingOf(fight, 0)?.perilous, null);
  });
});

describe("Zanshin", () => {
  const hitAt = landsAt(PRESS);
  const blade = (fight: Fight) => swingOf(fight, 0)!;

  test("a guard pressed just after a blade that connected takes posture off and the recovery short", () => {
    const fight = pvp();
    postureOf(fight, 0).value = 30;
    playTo(fight, hitAt, pressAt(PRESS, { attack: "light" }));
    assert.ok(hp(fight, 1) < FULL_HP);
    const { liveUntil, endAt } = blade(fight);
    const at = fight.steps + (liveUntil - blade(fight).step) + 2;
    const events = playTo(fight, at, (s) => ({ block: s === at }));
    assert.ok(events.some((e) => e.type === "posture" && e.what === "zanshin"));
    assert.equal(postureOf(fight, 0).value, 30 - POSTURE.zanshin.posture);
    assert.equal(blade(fight).endAt, endAt - toSteps(POSTURE.zanshin.recoverCutTime));
  });

  test("none for a swing that missed, nor pressed too late", () => {
    const missed = pvp({}, { at: { x: 0, y: 0.05, z: GAP_M + 5 } });
    postureOf(missed, 0).value = 30;
    playTo(missed, hitAt + 3, (s) => ({ attack: s === PRESS ? "light" : null, block: s === hitAt + 3 }));
    assert.equal(postureOf(missed, 0).value, 30);
    const late = pvp();
    postureOf(late, 0).value = 30;
    playTo(late, hitAt, pressAt(PRESS, { attack: "light" }));
    const tooLate = fight0End(late) + toSteps(POSTURE.zanshin.windowTime) + 2;
    playTo(late, tooLate, (s) => ({ block: s === tooLate }));
    assert.equal(postureOf(late, 0).value, 30);
  });

  const fight0End = (fight: Fight) => fight.steps + blade(fight).liveUntil - blade(fight).step;
});
