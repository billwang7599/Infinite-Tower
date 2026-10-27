import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DelayLine } from "../../src/ws/delay.js";

describe("DelayLine", () => {
  test("runs each callback delayMs after it was added, in the order added", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const ran: number[] = [];
    const line = new DelayLine(25);
    line.push(() => ran.push(1));
    t.mock.timers.tick(10);
    line.push(() => ran.push(2));
    t.mock.timers.tick(14);
    assert.deepEqual(ran, []);
    t.mock.timers.tick(1);
    assert.deepEqual(ran, [1]);
    t.mock.timers.tick(10);
    assert.deepEqual(ran, [1, 2]);
  });

  test("keeps the order of a burst that comes due at once", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const ran: number[] = [];
    const line = new DelayLine(500);
    for (let i = 0; i < 100; i++) line.push(() => ran.push(i));
    t.mock.timers.tick(500);
    assert.deepEqual(ran, Array.from({ length: 100 }, (_, i) => i));
  });

  test("takes half milliseconds (an odd ping split both ways)", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const ran: string[] = [];
    const line = new DelayLine(18.5);
    line.push(() => ran.push("a"));
    t.mock.timers.tick(18);
    assert.deepEqual(ran, []);
    t.mock.timers.tick(1);
    assert.deepEqual(ran, ["a"]);
  });

  test("0 is no delay: it runs at once", () => {
    const ran: number[] = [];
    const line = new DelayLine(0);
    line.push(() => ran.push(1));
    line.push(() => ran.push(2));
    assert.deepEqual(ran, [1, 2]);
  });
});
