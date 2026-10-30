import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { IDLE_INPUT, MAX_INPUT_LEAD_STEPS, type PlayerInputData, type StepInput } from "@infinite-tower/shared";
import { InputTimeline, SILENT_STOP_STEPS } from "../../../src/core/battle/inputs.js";

const WALK: PlayerInputData = { ...IDLE_INPUT, moveZ: 1 };
const at = (step: number, over: Partial<PlayerInputData> = {}): StepInput => ({ step, ...IDLE_INPUT, ...over });

/** Takes the inputs for steps `from`..`to` in turn. */
const takeRange = (timeline: InputTimeline, from: number, to: number): PlayerInputData[] => {
  const taken: PlayerInputData[] = [];
  for (let step = from; step <= to; step++) taken.push(timeline.take(step));
  return taken;
};

describe("InputTimeline", () => {
  test("before anything has come: not started, nothing known, idle", () => {
    const timeline = new InputTimeline();
    assert.equal(timeline.started, false);
    assert.equal(timeline.known(1), false);
    assert.deepEqual(timeline.take(1), IDLE_INPUT);
  });

  test("each change runs from its own step until the next one; steps up to upTo are known", () => {
    const timeline = new InputTimeline();
    timeline.receive(6, [at(1, WALK), at(3, { attack: "lr" }), at(4)], 0);
    assert.equal(timeline.started, true);
    assert.equal(timeline.known(6), true);
    assert.equal(timeline.known(7), false);
    assert.deepEqual(takeRange(timeline, 1, 6), [
      WALK, WALK, { ...IDLE_INPUT, attack: "lr" }, IDLE_INPUT, IDLE_INPUT, IDLE_INPUT,
    ]);
  });

  test("ignores a change it already has, or one older than the newest", () => {
    const timeline = new InputTimeline();
    timeline.receive(3, [at(2, WALK), at(3, { jump: true })], 0);
    timeline.receive(4, [at(3, { dodge: true })], 0);
    timeline.receive(4, [at(1, { attack: "lr" })], 0);
    const jump = { ...IDLE_INPUT, jump: true };
    assert.deepEqual(takeRange(timeline, 1, 4), [IDLE_INPUT, WALK, jump, jump]);
  });

  test("a change that came after its step was run counts on the next step, its presses kept", () => {
    const timeline = new InputTimeline();
    timeline.receive(2, [at(1, WALK)], 0);
    takeRange(timeline, 1, 5);
    // A tap: dodge down on step 3, up on step 4; both arrive after step 5 ran.
    timeline.receive(7, [at(3, { ...WALK, dodge: true }), at(4, WALK)], 6);
    assert.deepEqual(timeline.take(6), { ...WALK, dodge: true }, "pressed on the first step it can be");
    assert.deepEqual(timeline.take(7), WALK, "and let go after");
  });

  test("a late cast is kept, as a press is", () => {
    const timeline = new InputTimeline();
    timeline.receive(2, [at(1, WALK)], 0);
    takeRange(timeline, 1, 5);
    const cast = { segments: [{ form: "nova", elements: ["fire"], modifiers: [] }] } as const;
    timeline.receive(7, [at(3, { ...WALK, cast }), at(4, WALK)], 6);
    assert.deepEqual(timeline.take(6), { ...WALK, cast });
    assert.deepEqual(timeline.take(7), WALK);
  });

  test("a late meal is kept, as a press is", () => {
    const timeline = new InputTimeline();
    timeline.receive(2, [at(1, { bag: true })], 0);
    takeRange(timeline, 1, 5);
    const use = { in: "bag", x: 1, y: 0 } as const;
    timeline.receive(7, [at(3, { bag: true, use }), at(4, { bag: true })], 6);
    assert.deepEqual(timeline.take(6), { ...IDLE_INPUT, bag: true, use });
    assert.deepEqual(timeline.take(7), { ...IDLE_INPUT, bag: true });
  });

  test("late chant words are kept, the latest of them: each is the chant's words whole", () => {
    const timeline = new InputTimeline();
    timeline.receive(2, [at(1, WALK)], 0);
    takeRange(timeline, 1, 5);
    timeline.receive(7, [
      at(2, { ...WALK, chantWords: ["bolt"] }), at(3, WALK), at(4, { ...WALK, chantWords: ["bolt", "fire"] }),
      at(5, WALK),
    ], 6);
    assert.deepEqual(timeline.take(6), { ...WALK, chantWords: ["bolt", "fire"] });
    assert.deepEqual(timeline.take(7), WALK);
  });

  test("a change for a step too far ahead of the server's clock is dropped, and upTo held back", () => {
    const timeline = new InputTimeline();
    const now = 10, limit = now + MAX_INPUT_LEAD_STEPS;
    timeline.receive(limit + 5, [at(limit, WALK), at(limit + 1, { attack: "lr" })], now);
    assert.equal(timeline.known(limit), true);
    assert.equal(timeline.known(limit + 1), false);
    assert.deepEqual(takeRange(timeline, limit, limit + 2), [WALK, WALK, WALK]);
  });

  test("a step it doesn't know yet repeats the player's input; silent for long, they stop moving", () => {
    const timeline = new InputTimeline();
    const held: PlayerInputData = { ...WALK, aimX: 1, aimZ: 0, attack: "lr", block: true };
    timeline.receive(1, [at(1, held)], 0);
    timeline.take(1);
    const guessed = takeRange(timeline, 2, 2 + SILENT_STOP_STEPS - 1);
    assert.ok(guessed.every((input) => JSON.stringify(input) === JSON.stringify(held)), "held while it might be late");
    assert.deepEqual(timeline.take(2 + SILENT_STOP_STEPS), { ...held, moveX: 0, moveZ: 0 }, "then stopped, aim kept");
    timeline.receive(30, [], 20);
    assert.deepEqual(timeline.take(2 + SILENT_STOP_STEPS + 1), held, "known again: what they hold");
  });

  test("tells how late the player's inputs come: the best since it last told, or how long they've been silent", () => {
    const timeline = new InputTimeline();
    // On time: the input for the server's next step (now + 1) arrives before that step.
    timeline.receive(14, [], 13);
    assert.deepEqual(timeline.lateness(14), { lateSteps: 0, heardStep: 14 });
    timeline.receive(10, [], 13);
    timeline.receive(12, [], 14);
    timeline.receive(14, [], 18);
    assert.deepEqual(timeline.lateness(20), { lateSteps: 3, heardStep: 12 });
    assert.deepEqual(timeline.lateness(25), { lateSteps: 11, heardStep: 14 }, "nothing since: silent for 11 steps");
    timeline.receive(30, [], 27);
    assert.deepEqual(timeline.lateness(28), { lateSteps: -2, heardStep: 30 }, "early");
  });
});
