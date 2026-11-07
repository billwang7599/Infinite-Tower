import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT, HASH_EVERY_STEPS } from "@infinite-tower/shared";
import {
  MAX_BACKLOG_STEPS, MAX_STEPS_PER_FRAME, Pace, PACE_SLACK_STEPS, STALL_STEPS,
} from "../../../src/modes/battle/pace.js";

const STEP_MS = FIXED_DT * 1000;

/** A client on a fake clock: each frame it runs the steps due and sends its input up to there. */
function client() {
  let now = 0, step = 0;
  const pace = new Pace(() => now);
  /** `n` frames `frameMs` apart; returns the steps each one ran. */
  const frames = (n: number, frameMs = STEP_MS): number[] => {
    const ran: number[] = [];
    for (let i = 0; i < n; i++) {
      const steps = pace.stepsDue(step);
      step += steps;
      pace.sent(step);
      ran.push(steps);
      now += frameMs;
    }
    return ran;
  };
  return {
    pace, frames,
    /** Nothing runs for `ms` (a stalled page). */
    stall: (ms: number) => { now += ms; },
    /** The fight loaded the server's from step `to`. */
    jump: (to: number) => { step = to; pace.jumped(to); },
    step: () => step,
  };
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("the client's fight clock", () => {
  test("runs the steps real time asks for: one a frame at 60 frames a second, two at 30", () => {
    assert.deepEqual(client().frames(5), [1, 1, 1, 1, 1]);
    assert.deepEqual(client().frames(5, STEP_MS * 2).slice(1), [2, 2, 2, 2]);
  });

  test("at 60 frames a second, one a little late or early runs one step, however late the first was", () => {
    const lateMs = 0.4 * STEP_MS, lateness = (k: number) => (((k * 7) % 10) / 9) * lateMs;
    for (const firstLateMs of [0, lateMs / 2, lateMs]) {
      let now = 0, step = 0;
      const pace = new Pace(() => now), ran: number[] = [];
      for (let k = 0; k < 120; k++) {
        now = k * STEP_MS + (k === 0 ? firstLateMs : lateness(k));
        const steps = pace.stepsDue(step);
        step += steps;
        ran.push(steps);
      }
      assert.ok(ran.every((n) => n === 1), `first frame ${firstLateMs} ms late: ${JSON.stringify(ran)}`);
    }
  });

  test("alpha: how far real time is past the fight's last step, 0 to 1", () => {
    const c = client();
    c.frames(1, STEP_MS / 2);
    const first = c.pace.alpha;
    c.frames(1, STEP_MS / 2);
    const second = c.pace.alpha;
    assert.ok(first >= 0 && first < 1 && second >= 0 && second < 1, `${first}, ${second}`);
    assert.ok(Math.abs(Math.abs(second - first) - 0.5) < 1e-6, `half a step apart at 120 a second: ${first}, ${second}`);
    c.frames(10);
    c.stall(STEP_MS * 20);
    c.frames(1);
    assert.equal(c.pace.alpha, 1, "still catching up: the fight's last step is shown");
    c.frames(10);
    c.pace.report(-(PACE_SLACK_STEPS + 2), c.step() - 1, c.step());
    c.frames(1);
    assert.equal(c.pace.alpha, 0, "held back: the fight is ahead of the clock");
  });

  test("after a stall it catches up, MAX_STEPS_PER_FRAME a frame at most", () => {
    const c = client();
    c.frames(10);
    c.stall(STEP_MS * 20);
    const ran = c.frames(5);
    assert.ok(ran.every((n) => n <= MAX_STEPS_PER_FRAME), JSON.stringify(ran));
    assert.equal(sum(ran), 20 + 5);
  });

  test("a backlog past MAX_BACKLOG_STEPS (a hidden tab) is dropped", () => {
    const c = client();
    c.frames(10);
    c.stall(STEP_MS * (MAX_BACKLOG_STEPS + 100));
    // The first frame back runs the last MAX_BACKLOG_STEPS of it (the one step due then included), then one a frame.
    assert.equal(sum(c.frames(30)), MAX_BACKLOG_STEPS + 29);
  });

  test("the server says the inputs come late: the clock moves ahead that much", () => {
    const c = client();
    c.frames(30);
    c.pace.report(PACE_SLACK_STEPS + 7, 25, c.step());
    assert.equal(sum(c.frames(10)), 10 + PACE_SLACK_STEPS + 7);
  });

  test("within PACE_SLACK_STEPS either way, nothing changes", () => {
    const c = client();
    c.frames(30);
    c.pace.report(PACE_SLACK_STEPS, 25, c.step());
    c.pace.report(-PACE_SLACK_STEPS, 28, c.step());
    assert.deepEqual(c.frames(5), [1, 1, 1, 1, 1]);
  });

  test("early: it holds back that many steps", () => {
    const c = client();
    c.frames(30);
    c.pace.report(-(PACE_SLACK_STEPS + 2), 25, c.step());
    assert.deepEqual(c.frames(PACE_SLACK_STEPS + 4), [...Array(PACE_SLACK_STEPS + 2).fill(0), 1, 1]);
  });

  test("lateness it caused itself (behind its own clock after a stall) isn't made up twice", () => {
    const c = client(), twin = client();
    for (const x of [c, twin]) {
      x.frames(30);
      x.stall(STEP_MS * 20);
      x.frames(1);
    }
    // That input went out behind the client's own clock, and reached the server just that late.
    const heard = c.step(), behind = 30 + 20 + 1 - heard;
    assert.ok(behind > PACE_SLACK_STEPS);
    c.pace.report(behind, heard, c.step());
    assert.deepEqual(c.frames(10), twin.frames(10), "the same as with no news");
  });

  test("a stall's silence isn't lateness: the server's word on inputs sent before it doesn't move the clock", () => {
    const silentSteps = HASH_EVERY_STEPS;
    assert.ok(silentSteps > STALL_STEPS);
    for (const heardAfterStall of [false, true]) {
      const c = client(), twin = client();
      for (const x of [c, twin]) {
        x.frames(30);
        x.stall(STEP_MS * silentSteps);
      }
      const heard = c.step();
      if (heardAfterStall) {
        c.frames(1);
        twin.frames(1);
      }
      // Heard nothing since `heard`, the server reports it late by the whole silence.
      c.pace.report(silentSteps, heard, c.step());
      assert.deepEqual(c.frames(10), twin.frames(10), `the same as with no news (heard after: ${heardAfterStall})`);
    }
  });

  test("ignores news about inputs sent before its last correction took effect", () => {
    const c = client();
    c.frames(30);
    c.pace.report(10, 28, c.step());
    c.frames(10);
    c.pace.report(9, 32, c.step());
    assert.deepEqual(c.frames(3), [1, 1, 1], "old news: those went out before it caught up");
    c.pace.report(9, c.step() - 1, c.step());
    assert.ok(sum(c.frames(3)) > 3, "news about inputs sent since");
  });

  test("loading the server's fight from a step ahead moves the clock there", () => {
    const c = client();
    c.frames(30);
    c.jump(60);
    assert.deepEqual(c.frames(4), [0, 1, 1, 1], "on from there, not waiting 30 steps for its clock");
  });
});
