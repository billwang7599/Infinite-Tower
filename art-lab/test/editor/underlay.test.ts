import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOOK } from "@infinite-tower/shared";
import { render } from "@infinite-tower/client/src/gfx/look/art.js";
import { STARTER_CLOTHES } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { getPixel } from "../../src/editor/bitmap.js";
import { projectFromJson, projectToJson } from "../../src/editor/json.js";
import { NO_UNDERLAY, newProject, type Underlay } from "../../src/editor/layers.js";
import { PART_CHOICES, partAloneProject, SHOT_SETS } from "../../src/editor/lookParts.js";
import { underlayFrom, underlayPicture } from "../../src/editor/underlay.js";

const set = (name: string) => SHOT_SETS.find((s) => s.name === name)!;
const base: Underlay = { ...NO_UNDERLAY, shots: "portrait", body: "wide", face: "square", skin: "tan" };
const bareOf = (shots: string, page: number, look: typeof DEFAULT_LOOK, parts: readonly string[] = ["base"]) => {
  const sketch = set(shots).pages[page]!.sketch(look, STARTER_CLOTHES);
  return render(sketch, parts);
};

test("the underlay is the base model it names, bare, at the drawing's size", () => {
  const pic = underlayPicture(base, 0, 64, 64)!;
  assert.deepEqual(pic.rgba, bareOf("portrait", 0, { ...DEFAULT_LOOK, body: "wide", face: "square", skin: "tan" }).rgba);
});

test("with hair or dressed, those parts are drawn on it too", () => {
  const look = { ...DEFAULT_LOOK, body: "wide", face: "square", skin: "tan", hair: "bob" } as const;
  const pic = underlayPicture({ ...base, hair: "bob", dressed: true }, 0, 64, 64)!;
  assert.deepEqual(pic.rgba, bareOf("portrait", 0, look, ["base", "hair", ...Object.keys(STARTER_CLOTHES)]).rgba);
});

test("on an animation it follows the page: each frame gets its own pose", () => {
  const u = { ...base, shots: "chibi" };
  assert.notDeepEqual(underlayPicture(u, 0, 32, 32)!.rgba, underlayPicture(u, 2, 32, 32)!.rgba);
  assert.deepEqual(underlayPicture(u, 7, 32, 32)!.rgba, underlayPicture(u, 2, 32, 32)!.rgba);
});

test("none is drawn when it's off, or its pictures aren't the drawing's size", () => {
  assert.equal(underlayPicture(NO_UNDERLAY, 0, 64, 64), null);
  assert.equal(underlayPicture(base, 0, 32, 32), null);
});

test("every body type at once is each one tinted its own color, so a part can be checked against all of them", () => {
  const all = underlayPicture({ ...base, body: "all" }, 0, 64, 64)!;
  const only = (body: "skinny" | "wide") =>
    bareOf("portrait", 0, { ...DEFAULT_LOOK, body, face: "square", skin: "tan" });
  const [skinny, wide] = [only("skinny"), only("wide")];
  let wideOnly = -1;
  for (let i = 0; i < 64 * 64; i++) if (wide.rgba[i * 4 + 3] && !skinny.rgba[i * 4 + 3]) { wideOnly = i; break; }
  assert.ok(wideOnly >= 0);
  const [x, y] = [wideOnly % 64, Math.floor(wideOnly / 64)];
  assert.equal(getPixel(all, x, y)[3], 255);
  assert.notDeepEqual(getPixel(all, x, y), getPixel(wide, x, y));
});

test("it's saved with the drawing, and a bad one in a file is dropped", () => {
  const project = newProject(64, 64, ["a"]);
  project.underlay = { ...base, opacity: 0.5, shown: false };
  assert.deepEqual(projectFromJson(projectToJson("sprite", project)).project.underlay, project.underlay);
  assert.equal(underlayFrom({ shots: "nope" }), undefined);
  assert.equal(underlayFrom({ ...base, body: "huge" }), undefined);
  assert.equal(underlayFrom(undefined), undefined);
});

test("a part opened alone comes with the bare base under it", () => {
  const hair = PART_CHOICES.find((c) => c.name === "hair: long")!;
  const project = partAloneProject(hair, set("chibi"), { ...DEFAULT_LOOK, body: "skinny", face: "sharp" });
  assert.deepEqual(project.underlay, {
    ...NO_UNDERLAY, shots: "chibi", body: "skinny", face: "sharp", skin: DEFAULT_LOOK.skin, shown: true,
  });
});
