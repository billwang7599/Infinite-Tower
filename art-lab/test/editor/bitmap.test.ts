import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, getPixel, hexToRgba, rgbaToHex, setPixel } from "../../src/editor/bitmap.js";

test("a blank bitmap is clear and pixels set and read back", () => {
  const b = blank(3, 2);
  assert.deepEqual(getPixel(b, 2, 1), [0, 0, 0, 0]);
  setPixel(b, 2, 1, [10, 20, 30, 255]);
  assert.deepEqual(getPixel(b, 2, 1), [10, 20, 30, 255]);
});

test("pixels outside the bitmap are ignored", () => {
  const b = blank(2, 2);
  setPixel(b, 5, -1, [1, 1, 1, 255]);
  assert.deepEqual(getPixel(b, 5, -1), [0, 0, 0, 0]);
  assert.ok(b.rgba.every((v) => v === 0));
});

test("hex colors convert both ways", () => {
  assert.deepEqual(hexToRgba("#ff8000"), [255, 128, 0, 255]);
  assert.equal(rgbaToHex([255, 128, 0, 255]), "#ff8000");
});
