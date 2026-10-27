import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { IDLE_INPUT, type BattleInput, type PlayerInputData } from "@infinite-tower/shared";
import { INPUT_TIMEOUT_STEPS, InputQueue, MAX_WAITING_INPUTS } from "../../../src/core/battle/inputs.js";

const WALK: PlayerInputData = { ...IDLE_INPUT, moveZ: 1 };
const step = (seq: number, over: Partial<PlayerInputData> = {}): BattleInput => ({ seq, ...IDLE_INPUT, ...over });
const withoutSeq = ({ seq: _, ...input }: BattleInput): PlayerInputData => input;

describe("InputQueue", () => {
  test("before any input: idle, nothing acked, not started", () => {
    const queue = new InputQueue();
    assert.equal(queue.started, false);
    assert.deepEqual(queue.next(), IDLE_INPUT);
    assert.equal(queue.ack, 0);
  });

  test("takes one input a step, in order, and acks it", () => {
    const queue = new InputQueue();
    const inputs = [step(1, WALK), step(2, { attack: true }), step(3)];
    queue.push(inputs);
    assert.equal(queue.started, true);
    for (const input of inputs) {
      assert.deepEqual(queue.next(), withoutSeq(input));
      assert.equal(queue.ack, input.seq);
      assert.equal(queue.repeats, 0);
    }
  });

  test("ignores an input it already has, or one older than the newest", () => {
    const queue = new InputQueue();
    queue.push([step(1), step(2, WALK)]);
    queue.push([step(2, { dodge: true }), step(1, { attack: true }), step(3, { jump: true })]);
    assert.deepEqual([queue.next(), queue.next(), queue.next()], [IDLE_INPUT, WALK, { ...IDLE_INPUT, jump: true }]);
  });

  test("with none waiting, runs the last one again and counts it; a new one starts the count over", () => {
    const queue = new InputQueue();
    queue.push([step(1, WALK)]);
    queue.next();
    assert.deepEqual([queue.next(), queue.next()], [WALK, WALK]);
    assert.deepEqual({ ack: queue.ack, repeats: queue.repeats }, { ack: 1, repeats: 2 });
    queue.push([step(5)]);
    assert.deepEqual(queue.next(), IDLE_INPUT);
    assert.deepEqual({ ack: queue.ack, repeats: queue.repeats }, { ack: 5, repeats: 0 });
  });

  test("a player who goes quiet while moving is taken to have stopped, after INPUT_TIMEOUT_STEPS (aim kept)", () => {
    const queue = new InputQueue();
    queue.push([step(1, { ...WALK, aimX: 1, aimZ: 0, attack: true })]);
    queue.next();
    for (let i = 0; i < INPUT_TIMEOUT_STEPS; i++) assert.equal(queue.next().moveZ, 1, `repeat ${i + 1}`);
    assert.deepEqual(queue.next(), { ...IDLE_INPUT, aimX: 1, aimZ: 0 });
  });

  test("more than MAX_WAITING_INPUTS waiting (after a stall): the oldest go, their presses kept in the next", () => {
    const queue = new InputQueue();
    const late = Array.from({ length: MAX_WAITING_INPUTS + 3 }, (_, i) => step(i + 1, WALK));
    late[0] = step(1, { ...WALK, attack: true });
    queue.push(late);
    const first = queue.next();
    assert.equal(queue.ack, 4, "1 to 3 were merged into 4");
    assert.deepEqual(first, { ...WALK, attack: true });
    let taken = 1;
    while (queue.repeats === 0) {
      queue.next();
      taken++;
    }
    assert.equal(taken - 1, MAX_WAITING_INPUTS, "then one a step, as usual");
  });
});
