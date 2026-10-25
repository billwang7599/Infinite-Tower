import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  LEAVE_COVERED_MS, nextRun, runStage, stageMs, stepsOf, type Run, type Stage,
} from "../../../../src/ui/screens/title/sequence.js";

const START = 1000;
const MINUTES_10 = 10 * 60_000;

const enter = (readyAt: number | null = null): Run => ({ kind: "enter", startedAt: START, readyAt });
const leave = (): Run => ({ kind: "leave", startedAt: START, readyAt: null });
const stage = (run: Run | null, now: number, reduced = false) => runStage(run, now, reduced).stage;
/** When the step for `name` starts, counting from the run's start, ignoring any wait for the game. */
const startOf = (kind: Run["kind"], name: Stage, reduced = false) => {
  let t = 0;
  for (const step of stepsOf(kind, reduced)) {
    if (step.stage === name) return t;
    t += step.ms;
  }
  throw new Error(`no ${name} step`);
};
const msOf = (kind: Run["kind"], name: Stage, reduced = false) =>
  stepsOf(kind, reduced).find((s) => s.stage === name)?.ms ?? 0;

/** Every stage the run shows, in order, following nextInMs from its start. */
function stagesOf(run: Run, reduced = false): Stage[] {
  const seen: Stage[] = [];
  let now = run.startedAt;
  for (let i = 0; i < 50; i++) {
    const { stage, nextInMs } = runStage(run, now, reduced);
    if (seen.at(-1) !== stage) seen.push(stage);
    if (nextInMs === null) return seen;
    now += nextInMs;
  }
  throw new Error("never settles");
}

describe("entering the world", () => {
  test("fades the title, goes to the foot of the tower, looks up it, rushes up, flashes white, shows the world", () => {
    assert.deepEqual(stagesOf(enter(START)), ["fade", "approach", "lookUp", "rush", "flash", "reveal", "done"]);
  });

  test("the look up the tower never waits for the game; only the rush does", () => {
    assert.equal(stage(enter(), START + startOf("enter", "rush")), "rush");
    assert.equal(stage(enter(), START + startOf("enter", "rush") - 1), "lookUp");
  });

  test("the rush holds until the game is ready, however long that takes", () => {
    assert.deepEqual(runStage(enter(), START + MINUTES_10, false), { stage: "rush", nextInMs: null });
  });

  test("a game that's ready at once still gets the whole rush", () => {
    const rushEnd = START + startOf("enter", "rush") + msOf("enter", "rush");
    assert.ok(msOf("enter", "rush") > 0);
    assert.equal(stage(enter(START), rushEnd - 1), "rush");
    assert.equal(stage(enter(START), rushEnd), "flash");
  });

  test("a slow game: the flash starts the moment it's ready, and runs its full time", () => {
    const readyAt = START + startOf("enter", "rush") + msOf("enter", "rush") + 3000;
    assert.equal(stage(enter(readyAt), readyAt - 1), "rush");
    assert.equal(stage(enter(readyAt), readyAt), "flash");
    assert.equal(stage(enter(readyAt), readyAt + msOf("enter", "flash") - 1), "flash");
    assert.equal(stage(enter(readyAt), readyAt + msOf("enter", "flash")), "reveal");
  });

  test("going back to the menu (the connection failed) cancels it", () => {
    for (const phase of ["menu", "failed"] as const) {
      assert.equal(nextRun(enter(), phase, START + 500), null);
      assert.equal(stage(nextRun(enter(), phase, START + 500), START + 500), "menu");
    }
  });

  test("reduced motion: no camera moves and no minimum rush, just the fades", () => {
    assert.deepEqual(stagesOf(enter(START), true), ["fade", "flash", "reveal", "done"]);
    assert.equal(stage(enter(), START + MINUTES_10, true), "rush");
  });
});

describe("returning to the title", () => {
  test("whites out the world, rushes back out of the tower, pulls back, then the menu", () => {
    assert.deepEqual(stagesOf(leave()), ["whiteout", "rushOut", "pullBack", "menu"]);
  });

  test("the game is stopped only once the white covers the world", () => {
    for (const reduced of [false, true]) {
      assert.equal(LEAVE_COVERED_MS, msOf("leave", "whiteout", reduced));
      assert.equal(stage(leave(), START + LEAVE_COVERED_MS - 1, reduced), "whiteout");
      assert.notEqual(stage(leave(), START + LEAVE_COVERED_MS, reduced), "whiteout");
    }
  });

  test("reduced motion: just the white, then the menu", () => {
    assert.deepEqual(stagesOf(leave(), true), ["whiteout", "menu"]);
  });

  test("it keeps going when the phase is back to menu (or failed)", () => {
    const run = leave();
    assert.equal(nextRun(run, "menu", START + LEAVE_COVERED_MS), run);
    assert.equal(nextRun(run, "failed", START + LEAVE_COVERED_MS), run);
  });
});

describe("runStage", () => {
  test("no run: the menu, with nothing to wait for", () => {
    assert.deepEqual(runStage(null, START, false), { stage: "menu", nextInMs: null });
  });

  test("before its start the run is at its first stage", () => {
    assert.equal(stage(enter(), START - 50), "fade");
    assert.equal(stage(leave(), START - 50), "whiteout");
  });

  for (const [name, run] of [
    ["ready at once", enter(START)], ["ready late", enter(START + 9000)], ["leaving", leave()],
  ] as const) {
    test(`${name}: nextInMs lands exactly on the next change, and stages never go back`, () => {
      const order = stagesOf(run);
      let last = 0;
      for (let now = START; now < START + 15_000; now += 37) {
        const { stage: here, nextInMs } = runStage(run, now, false);
        const index = order.indexOf(here);
        assert.ok(index >= last, `${here} came after ${order[last]}`);
        last = index;
        if (nextInMs === null) continue;
        assert.ok(nextInMs > 0);
        assert.equal(stage(run, now + nextInMs - 1), here);
        assert.notEqual(stage(run, now + nextInMs), here);
      }
    });
  }
});

describe("stageMs", () => {
  test("each stage's own time, for the screen's transitions; nothing for the menu and done", () => {
    for (const kind of ["enter", "leave"] as const) {
      for (const step of stepsOf(kind, false)) assert.equal(stageMs(step.stage), step.ms);
    }
    assert.equal(stageMs("menu"), 0);
    assert.equal(stageMs("done"), 0);
  });
});

describe("nextRun", () => {
  test("Play starts entering; loading keeps it; the game joining marks it ready", () => {
    const started = nextRun(null, "connecting", START);
    assert.deepEqual(started, enter());
    assert.equal(nextRun(started, "loading", START + 100), started);
    assert.deepEqual(nextRun(started, "entering", START + 700), enter(START + 700));
  });

  test("ready only once: a second 'entering' doesn't move it", () => {
    const ready = enter(START + 700);
    assert.equal(nextRun(ready, "entering", START + 5000), ready);
  });

  test("returning starts the way back, even in the middle of entering", () => {
    assert.deepEqual(nextRun(null, "returning", START), leave());
    assert.deepEqual(nextRun(enter(START), "returning", START), leave());
  });

  test("logging in doesn't start anything; the sequence waits until the login worked", () => {
    assert.equal(nextRun(null, "signingIn", START), null);
    assert.equal(nextRun(null, "menu", START), null);
    assert.equal(nextRun(null, "checking", START), null);
  });

  test("playing: the title has cleared off the world, and has nothing left to play", () => {
    assert.equal(nextRun(enter(START), "playing", START + 5000), null);
    assert.deepEqual(nextRun(null, "returning", START + 9000), { ...leave(), startedAt: START + 9000 });
  });
});
