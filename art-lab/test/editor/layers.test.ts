import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, getPixel, setPixel } from "../../src/editor/bitmap.js";
import {
  PARTS, addLayer, addPage, composite, movePage, moveLayer, newDoc, newProject, projectOf, removeLayer, removePage,
  setLayer,
} from "../../src/editor/layers.js";

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

test("layers move, are added and removed, and changed on every page alike", () => {
  const project = newProject(2, 2, PARTS);
  addPage(project, 0);
  moveLayer(project, 0, 1);
  for (const page of project.pages) assert.deepEqual(page.layers.slice(0, 2).map((l) => l.name), [PARTS[1], PARTS[0]]);
  assert.equal(moveLayer(project, 0, -1), 0);
  assert.equal(addLayer(project, "sketch", 1), 2);
  setLayer(project, 2, { opacity: 0.5, visible: false });
  for (const page of project.pages) assert.deepEqual([page.layers[2]!.name, page.layers[2]!.opacity], ["sketch", 0.5]);
  removeLayer(project, 2);
  assert.ok(project.pages.every((p) => p.layers.length === PARTS.length));
});

test("a new page has the same layers, empty; a copy has the same pixels, apart", () => {
  const project = newProject(2, 2, ["ground", "detail"]);
  setPixel(project.pages[0]!.layers[1]!.pixels, 1, 1, [9, 9, 9, 255]);
  setLayer(project, 1, { opacity: 0.3 });
  const blankAt = addPage(project, 0);
  assert.equal(blankAt, 1);
  assert.deepEqual(project.pages[1]!.layers.map((l) => [l.name, l.opacity]), [["ground", 1], ["detail", 0.3]]);
  assert.deepEqual(getPixel(project.pages[1]!.layers[1]!.pixels, 1, 1), [0, 0, 0, 0]);
  const copyAt = addPage(project, 0, true);
  setPixel(project.pages[copyAt]!.layers[1]!.pixels, 0, 0, [1, 1, 1, 255]);
  assert.deepEqual(getPixel(project.pages[copyAt]!.layers[1]!.pixels, 1, 1), [9, 9, 9, 255]);
  assert.deepEqual(getPixel(project.pages[0]!.layers[1]!.pixels, 0, 0), [0, 0, 0, 0]);
});

test("pages move and are removed, keeping at least one", () => {
  const project = newProject(1, 1, ["a"]);
  addPage(project, 0);
  project.pages[1]!.name = "second";
  assert.equal(movePage(project, 1, -1), 0);
  assert.equal(project.pages[0]!.name, "second");
  removePage(project, 0);
  removePage(project, 0);
  assert.equal(project.pages.length, 1);
});

const named = (name: string, width: number, height: number, mark: number) => {
  const pixels = blank(width, height);
  setPixel(pixels, width - 1, height - 1, [mark, 0, 0, 255]);
  return { name, pixels };
};

test("pictures become the layers of one page, the first at the bottom, each as drawn", () => {
  const p = projectOf([named("body", 2, 2, 1), named("hair", 2, 2, 2)], "layers");
  assert.equal(p.pages.length, 1);
  assert.deepEqual(p.pages[0]!.layers.map((l) => l.name), ["body", "hair"]);
  assert.deepEqual(getPixel(p.pages[0]!.layers[1]!.pixels, 1, 1), [2, 0, 0, 255]);
});

test("pictures become pages, one layer each, named after them", () => {
  const p = projectOf([named("walk 1", 2, 2, 1), named("walk 2", 2, 2, 2)], "pages");
  assert.deepEqual(p.pages.map((d) => d.name), ["walk 1", "walk 2"]);
  assert.ok(p.pages.every((d) => d.layers.length === 1));
  assert.deepEqual(getPixel(p.pages[1]!.layers[0]!.pixels, 1, 1), [2, 0, 0, 255]);
});

test("pictures of different sizes fit the biggest, each at the top left, unscaled", () => {
  const p = projectOf([named("small", 1, 1, 1), named("big", 3, 2, 2)], "pages");
  assert.deepEqual([p.pages[0]!.width, p.pages[0]!.height], [3, 2]);
  assert.deepEqual(getPixel(p.pages[0]!.layers[0]!.pixels, 0, 0), [1, 0, 0, 255]);
  assert.deepEqual(getPixel(p.pages[0]!.layers[0]!.pixels, 1, 1), [0, 0, 0, 0]);
});

test("a picture bigger than a drawing can be is refused", () => {
  assert.throws(() => projectOf([{ name: "huge", pixels: blank(1024, 8) }], "pages"));
});
