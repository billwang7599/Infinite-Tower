import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, getPixel, setPixel, type Rgba } from "../../src/editor/bitmap.js";
import { placeImage, resize, snapToPalette } from "../../src/editor/resample.js";

const WHITE: Rgba = [255, 255, 255, 255];
const BLACK: Rgba = [0, 0, 0, 255];

const checker = () => {
  const b = blank(2, 2);
  setPixel(b, 0, 0, WHITE);
  setPixel(b, 1, 1, WHITE);
  setPixel(b, 1, 0, BLACK);
  setPixel(b, 0, 1, BLACK);
  return b;
};

test("nearest keeps one source pixel per target pixel", () => {
  const b = blank(4, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) setPixel(b, x, y, x < 2 ? WHITE : BLACK);
  const small = resize(b, 2, 2, "nearest");
  assert.deepEqual(getPixel(small, 0, 1), WHITE);
  assert.deepEqual(getPixel(small, 1, 1), BLACK);
});

test("smooth averages the pixels a target pixel covers", () => {
  const [r, g, b, a] = getPixel(resize(checker(), 1, 1, "smooth"), 0, 0);
  assert.equal(a, 255);
  assert.ok(Math.abs(r - 128) <= 1 && r === g && g === b);
});

test("smooth doesn't darken edges with clear pixels", () => {
  const src = blank(2, 1);
  setPixel(src, 0, 0, WHITE);
  const [r, , , a] = getPixel(resize(src, 1, 1, "smooth"), 0, 0);
  assert.equal(r, 255);
  assert.ok(Math.abs(a - 128) <= 1);
});

test("an image is fitted inside the canvas, centered, keeping its shape", () => {
  const wide = blank(8, 4);
  wide.rgba.fill(255);
  const placed = placeImage(wide, 4, 4, "contain", "nearest");
  assert.deepEqual(getPixel(placed, 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(getPixel(placed, 0, 1), WHITE);
  assert.deepEqual(getPixel(placed, 3, 2), WHITE);
  assert.deepEqual(getPixel(placed, 3, 3), [0, 0, 0, 0]);
});

test("cover fills the canvas, cropping the sides", () => {
  const wide = blank(8, 4);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) setPixel(wide, x, y, x < 2 || x >= 6 ? BLACK : WHITE);
  const placed = placeImage(wide, 4, 4, "cover", "nearest");
  for (let x = 0; x < 4; x++) assert.deepEqual(getPixel(placed, x, 0), WHITE);
});

test("snapping turns each pixel into the nearest palette color and drops faint ones", () => {
  const b = blank(2, 1);
  setPixel(b, 0, 0, [240, 10, 20, 255]);
  setPixel(b, 1, 0, [240, 10, 20, 40]);
  const palette: Rgba[] = [[255, 0, 0, 255], [0, 255, 0, 255]];
  snapToPalette(b, palette);
  assert.deepEqual(getPixel(b, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(getPixel(b, 1, 0), [0, 0, 0, 0]);
});
