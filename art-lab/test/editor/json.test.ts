import assert from "node:assert/strict";
import { test } from "node:test";
import { getPixel, setPixel } from "../../src/editor/bitmap.js";
import { projectFromJson, projectToJson } from "../../src/editor/json.js";
import { PARTS, addPage, newProject, setLayer } from "../../src/editor/layers.js";

test("a tileset saved as JSON loads back the same", () => {
  const project = newProject(3, 2, PARTS);
  addPage(project, 0);
  project.pages[1]!.name = "grass";
  setPixel(project.pages[1]!.layers[1]!.pixels, 2, 1, [1, 2, 3, 4]);
  setLayer(project, 1, { opacity: 0.25 });
  setLayer(project, 3, { visible: false });
  project.fps = 12;
  const back = projectFromJson(projectToJson("tiles", project));
  assert.equal(back.mode, "tiles");
  assert.equal(back.project.fps, 12);
  assert.equal(back.project.pages.length, 2);
  assert.equal(back.project.pages[1]!.name, "grass");
  const layers = (p: typeof project) => p.pages[1]!.layers.map((l) => [l.name, l.visible, l.opacity]);
  assert.deepEqual(layers(back.project), layers(project));
  assert.deepEqual(getPixel(back.project.pages[1]!.layers[1]!.pixels, 2, 1), [1, 2, 3, 4]);
});

test("a file that isn't a drawing is refused", () => {
  assert.throws(() => projectFromJson("{\"width\":2}"));
  const page = (pixels: string) => ({ width: 1, height: 1, layers: [{ name: "x", visible: true, opacity: 1, pixels }] });
  assert.throws(() => projectFromJson(JSON.stringify({ mode: "sprite", pages: [page("AA")] })));
  assert.throws(() => projectFromJson(JSON.stringify({ mode: "nope", pages: [page("AAAAAA==")] })));
});
