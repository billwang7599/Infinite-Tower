import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, getPixel, setPixel } from "../../src/editor/bitmap.js";
import { frameAt, packSheet, sheetJson, splitSheet, tiled } from "../../src/editor/sheet.js";

test("a sheet lays the pictures out left to right, then down", () => {
  const pictures = [0, 1, 2].map((i) => {
    const b = blank(2, 2);
    setPixel(b, 0, 0, [i, 0, 0, 255]);
    return b;
  });
  const { sheet, cells } = packSheet(pictures, 2);
  assert.deepEqual([sheet.width, sheet.height], [4, 4]);
  assert.deepEqual(cells, [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }]);
  assert.deepEqual(getPixel(sheet, 2, 0), [1, 0, 0, 255]);
  assert.deepEqual(getPixel(sheet, 0, 2), [2, 0, 0, 255]);
});

test("a sheet never has more columns than pictures", () => {
  assert.equal(packSheet([blank(3, 1)], 8).sheet.width, 3);
});

test("tiling repeats a picture across and down", () => {
  const b = blank(2, 1);
  setPixel(b, 1, 0, [7, 7, 7, 255]);
  const out = tiled(b, 3, 2);
  assert.deepEqual([out.width, out.height], [6, 2]);
  assert.deepEqual(getPixel(out, 5, 1), [7, 7, 7, 255]);
  assert.deepEqual(getPixel(out, 4, 1), [0, 0, 0, 0]);
});

test("an animation plays its frames at its fps, round and round", () => {
  assert.equal(frameAt(0, 10, 4), 0);
  assert.equal(frameAt(0.25, 10, 4), 2);
  assert.equal(frameAt(0.45, 10, 4), 0);
});

test("a sheet's JSON names each picture and where it is", () => {
  const cells = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
  assert.deepEqual(sheetJson("walk.png", 4, 2, ["", "step"], cells, "frame", { fps: 8 }), {
    image: "walk.png", width: 4, height: 2, fps: 8,
    frames: [{ name: "frame 1", x: 0, y: 0 }, { name: "step", x: 4, y: 0 }],
  });
});

test("a sheet splits into its cells, left to right then down, pixel for pixel", () => {
  const pictures = [0, 1, 2].map((i) => {
    const b = blank(2, 3);
    setPixel(b, 1, 2, [i + 1, 0, 0, 255]);
    return b;
  });
  const cells = splitSheet(packSheet(pictures, 2).sheet, 2, 3);
  assert.equal(cells.length, 3);
  cells.forEach((cell, i) => {
    assert.deepEqual([cell.width, cell.height], [2, 3]);
    assert.deepEqual(getPixel(cell, 1, 2), [i + 1, 0, 0, 255]);
  });
});

test("splitting drops the empty cells a sheet ends with, not those between", () => {
  const sheet = blank(8, 2);
  setPixel(sheet, 4, 0, [1, 1, 1, 255]);
  assert.equal(splitSheet(sheet, 2, 2).length, 3);
});

test("cells that don't fit the sheet whole are left out, and a cell bigger than it is refused", () => {
  assert.equal(splitSheet(blank(5, 2), 2, 2, false).length, 2);
  assert.throws(() => splitSheet(blank(4, 4), 8, 2));
  assert.throws(() => splitSheet(blank(4, 4), 0, 2));
});
