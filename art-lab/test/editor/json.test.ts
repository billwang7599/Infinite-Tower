import assert from "node:assert/strict";
import { test } from "node:test";
import { getPixel, setPixel } from "../../src/editor/bitmap.js";
import { docFromJson, docToJson } from "../../src/editor/json.js";
import { newDoc } from "../../src/editor/layers.js";

test("a drawing saved as JSON loads back the same", () => {
  const doc = newDoc(3, 2);
  setPixel(doc.layers[1]!.pixels, 2, 1, [1, 2, 3, 4]);
  doc.layers[1]!.opacity = 0.25;
  doc.layers[3]!.visible = false;
  const back = docFromJson(docToJson(doc));
  assert.equal(back.width, 3);
  assert.deepEqual(back.layers.map((l) => [l.name, l.visible, l.opacity]), doc.layers.map((l) => [l.name, l.visible, l.opacity]));
  assert.deepEqual(getPixel(back.layers[1]!.pixels, 2, 1), [1, 2, 3, 4]);
});

test("a file that isn't a drawing is refused", () => {
  assert.throws(() => docFromJson("{\"width\":2}"));
  assert.throws(() => docFromJson(JSON.stringify({ width: 1, height: 1, layers: [{ name: "x", visible: true, opacity: 1, pixels: "AAAA" }, { name: "y", visible: true, opacity: 1, pixels: "AA" }] })));
});
