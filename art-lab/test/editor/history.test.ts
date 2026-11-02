import assert from "node:assert/strict";
import { test } from "node:test";
import { History } from "../../src/editor/history.js";

test("undo goes back to what was recorded and redo forward again", () => {
  const h = new History<number[]>((s) => [...s], 10);
  let state = [1];
  h.record(state);
  state = [1, 2];
  state = h.undo(state)!;
  assert.deepEqual(state, [1]);
  state = h.redo(state)!;
  assert.deepEqual(state, [1, 2]);
  assert.equal(h.redo(state), null);
});

test("a new change drops what could be redone", () => {
  const h = new History<string>((s) => s, 10);
  h.record("a");
  const back = h.undo("b")!;
  h.record(back);
  assert.equal(h.redo("c"), null);
});

test("only the newest steps are kept", () => {
  const h = new History<number>((s) => s, 2);
  for (const s of [1, 2, 3]) h.record(s);
  assert.equal(h.undo(4), 3);
  assert.equal(h.undo(3), 2);
  assert.equal(h.undo(2), null);
});

test("recording copies the state, so later edits don't change it", () => {
  const h = new History<number[]>((s) => [...s], 10);
  const state = [1];
  h.record(state);
  state.push(2);
  assert.deepEqual(h.undo(state), [1]);
});
