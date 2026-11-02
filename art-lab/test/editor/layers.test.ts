import assert from "node:assert/strict";
import { test } from "node:test";
import { getPixel, setPixel } from "../../src/editor/bitmap.js";
import { PARTS, addLayer, composite, moveLayer, newDoc, removeLayer } from "../../src/editor/layers.js";

test("a new drawing has a layer per part, bottom to top", () => {
  const doc = newDoc(64, 64);
  assert.deepEqual(doc.layers.map((l) => l.name), [...PARTS]);
  assert.ok(doc.layers.every((l) => l.pixels.width === 64 && l.visible && l.opacity === 1));
});

test("a higher layer covers a lower one, and hidden layers don't show", () => {
  const doc = newDoc(1, 1);
  setPixel(doc.layers[0]!.pixels, 0, 0, [255, 0, 0, 255]);
  setPixel(doc.layers[1]!.pixels, 0, 0, [0, 0, 255, 255]);
  assert.deepEqual(getPixel(composite(doc), 0, 0), [0, 0, 255, 255]);
  doc.layers[1]!.visible = false;
  assert.deepEqual(getPixel(composite(doc), 0, 0), [255, 0, 0, 255]);
});

test("a layer's opacity blends it over what's under it", () => {
  const doc = newDoc(1, 1);
  setPixel(doc.layers[0]!.pixels, 0, 0, [0, 0, 0, 255]);
  setPixel(doc.layers[1]!.pixels, 0, 0, [255, 255, 255, 255]);
  doc.layers[1]!.opacity = 0.5;
  const [r, , , a] = getPixel(composite(doc), 0, 0);
  assert.equal(a, 255);
  assert.ok(Math.abs(r - 128) <= 1);
});

test("over nothing, a half-opaque layer stays its own color, half clear", () => {
  const doc = newDoc(1, 1);
  setPixel(doc.layers[2]!.pixels, 0, 0, [200, 100, 50, 255]);
  doc.layers[2]!.opacity = 0.5;
  const [r, g, b, a] = getPixel(composite(doc), 0, 0);
  assert.deepEqual([r, g, b], [200, 100, 50]);
  assert.ok(Math.abs(a - 128) <= 1);
});

test("layers move up and down, staying in bounds, and are added and removed", () => {
  const doc = newDoc(2, 2);
  moveLayer(doc, 0, 1);
  assert.deepEqual(doc.layers.slice(0, 2).map((l) => l.name), [PARTS[1], PARTS[0]]);
  moveLayer(doc, 0, -1);
  assert.equal(doc.layers[0]!.name, PARTS[1]);
  const index = addLayer(doc, "sketch", 1);
  assert.equal(index, 2);
  assert.equal(doc.layers[2]!.name, "sketch");
  removeLayer(doc, 2);
  assert.equal(doc.layers.length, PARTS.length);
});
