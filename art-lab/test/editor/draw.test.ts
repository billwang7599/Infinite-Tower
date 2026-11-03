import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, getPixel, setPixel, type Rgba } from "../../src/editor/bitmap.js";
import { floodFill, linePoints, rectPoints } from "../../src/editor/draw.js";

const RED: Rgba = [255, 0, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];

test("a line covers both ends with no gaps", () => {
  const points = linePoints(0, 0, 5, 2);
  assert.deepEqual(points[0], [0, 0]);
  assert.deepEqual(points.at(-1), [5, 2]);
  assert.equal(points.length, 6);
  for (let i = 1; i < points.length; i++) {
    assert.ok(Math.abs(points[i]![0] - points[i - 1]![0]) <= 1 && Math.abs(points[i]![1] - points[i - 1]![1]) <= 1);
  }
});

test("a line goes backwards as well as forwards", () => {
  assert.deepEqual(linePoints(2, 3, 2, 0), [[2, 3], [2, 2], [2, 1], [2, 0]]);
});

test("a rectangle's outline is its border only, a filled one every cell", () => {
  const outline = rectPoints(3, 3, 0, 0, false);
  assert.equal(outline.length, 12);
  assert.ok(!outline.some(([x, y]) => x === 1 && y === 1));
  assert.equal(rectPoints(0, 0, 3, 3, true).length, 16);
});

test("fill spreads over the touching pixels of one color only", () => {
  const b = blank(4, 4);
  for (let y = 0; y < 4; y++) setPixel(b, 2, y, BLUE);
  floodFill(b, 0, 0, RED);
  assert.deepEqual(getPixel(b, 1, 3), RED);
  assert.deepEqual(getPixel(b, 2, 0), BLUE);
  assert.deepEqual(getPixel(b, 3, 0), [0, 0, 0, 0]);
});

test("filling with the color already there changes nothing", () => {
  const b = blank(2, 2);
  floodFill(b, 0, 0, [0, 0, 0, 0]);
  assert.ok(b.rgba.every((v) => v === 0));
});
