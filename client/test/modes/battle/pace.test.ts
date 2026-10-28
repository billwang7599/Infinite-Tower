import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT } from "@infinite-tower/shared";
import { MAX_BACKLOG_STEPS, MAX_STEPS_PER_FRAME, Pace, PACE_SLACK_STEPS } from "../../../src/modes/battle/pace.js";

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
