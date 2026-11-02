import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, getPixel, setPixel } from "../../src/editor/bitmap.js";
import { copyRect, lift, rectBetween, stamp } from "../../src/editor/selection.js";

test("a selection spans both corners whichever way it was dragged", () => {
  assert.deepEqual(rectBetween(3, 4, 1, 1), { x: 1, y: 1, w: 3, h: 4 });
});

test("lifting takes the pixels out, stamping puts them down elsewhere", () => {
  const b = blank(4, 4);
  setPixel(b, 1, 1, [9, 9, 9, 255]);
  const piece = lift(b, { x: 1, y: 1, w: 2, h: 2 });
  assert.deepEqual(getPixel(b, 1, 1), [0, 0, 0, 0]);
  assert.deepEqual(getPixel(piece, 0, 0), [9, 9, 9, 255]);
  stamp(b, piece, 2, 2);
  assert.deepEqual(getPixel(b, 2, 2), [9, 9, 9, 255]);
});

test("a stamped piece's clear pixels leave what's under them", () => {
  const b = blank(2, 1);
  setPixel(b, 1, 0, [5, 5, 5, 255]);
  stamp(b, blank(2, 1), 0, 0);
  assert.deepEqual(getPixel(b, 1, 0), [5, 5, 5, 255]);
});

test("copying takes the pixels and leaves them where they were", () => {
  const b = blank(3, 3);
  setPixel(b, 2, 2, [4, 4, 4, 255]);
  const piece = copyRect(b, { x: 1, y: 1, w: 2, h: 2 });
  assert.deepEqual(getPixel(piece, 1, 1), [4, 4, 4, 255]);
  assert.deepEqual(getPixel(b, 2, 2), [4, 4, 4, 255]);
});
