import assert from "node:assert/strict";
import { test } from "node:test";
import { WheelZoom, wheelPx } from "../../src/editor/wheel.js";

test("one notch of a mouse wheel is one zoom step, up zooming in", () => {
  const wheel = new WheelZoom();
  assert.equal(wheel.steps(-100, 0), 1);
  assert.equal(wheel.steps(100, 1000), -1);
});

test("a big notch is still only one step", () => {
  assert.equal(new WheelZoom().steps(-900, 0), 1);
});

test("notches spun one after another each step", () => {
  const wheel = new WheelZoom();
  const steps = [0, 100, 200, 300].map((ms) => wheel.steps(-100, ms));
  assert.deepEqual(steps, [1, 1, 1, 1]);
});

test("a small trackpad flick, many small deltas, is a single step", () => {
  const wheel = new WheelZoom();
  let total = 0;
  for (let i = 0; i < 12; i++) total += wheel.steps(-6, i * 16);
  assert.equal(total, 1);
});

test("a long trackpad swipe steps now and then, not on every event", () => {
  const wheel = new WheelZoom();
  let total = 0;
  for (let i = 0; i < 60; i++) total += wheel.steps(-20, i * 16);
  assert.ok(total >= 3 && total <= 12, `stepped ${total}`);
});

test("a tiny nudge on its own doesn't zoom", () => {
  assert.equal(new WheelZoom().steps(-1, 0), 0);
});

test("wheel deltas in lines or pages become pixels, and a pinch counts more", () => {
  const event = (deltaY: number, deltaMode: number, ctrlKey = false) => ({ deltaY, deltaMode, ctrlKey });
  assert.equal(wheelPx(event(-100, 0)), -100);
  assert.ok(wheelPx(event(-3, 1)) <= -100);
  assert.ok(wheelPx(event(1, 2)) >= 100);
  assert.ok(Math.abs(wheelPx(event(-5, 0, true))) > 5);
});
