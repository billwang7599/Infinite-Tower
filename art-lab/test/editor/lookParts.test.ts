import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS } from "@infinite-tower/shared";
import { render } from "@infinite-tower/client/src/gfx/look/art.js";
import { drawBattle, drawChibi, drawPortrait } from "@infinite-tower/client/src/gfx/look/look.js";
import { STARTER_CLOTHES } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { partAloneProject, partsProject, PART_CHOICES, SHOT_SETS } from "../../src/editor/lookParts.js";
import { composite } from "../../src/editor/layers.js";

const set = (name: string) => SHOT_SETS.find((s) => s.name === name)!;
const look = { ...DEFAULT_LOOK, body: "wide", face: "sharp", hair: "ponytail" } as const;

test("there's a set of pictures for the portrait, the chibi's facings and each battle pose from either side", () => {
  assert.deepEqual(set("portrait").pages.map((p) => p.name), ["portrait"]);
  assert.deepEqual(set("chibi").pages.map((p) => p.name), ["front", "back", "side"]);
  assert.deepEqual(set("battle swing-lr back").pages.map((p) => p.name), ["swing-lr 1", "swing-lr 2", "swing-lr 3"]);
  assert.ok(SHOT_SETS.some((s) => s.name === "battle stand front"));
});

test("a look opened as its parts is a layer per part, and the layers stacked are the game's picture", () => {
  const expected = {
    portrait: [drawPortrait(look)],
    chibi: (["front", "back", "side"] as const).map((f) => drawChibi(look, f)),
    "battle swing-tlbr front": [0, 1, 2].map((frame) => drawBattle(look, "swing-tlbr", frame, "front")),
  };
  for (const [name, pictures] of Object.entries(expected)) {
    const project = partsProject(set(name), look, STARTER_CLOTHES);
    assert.equal(project.pages.length, pictures.length, name);
    project.pages.forEach((page, i) => {
      assert.ok(page.layers.length > 4, `${name}: ${page.layers.map((l) => l.name)}`);
      assert.deepEqual(composite(page).rgba, pictures[i]!.rgba, `${name} page ${i}`);
    });
  }
});

test("the layers are named for their parts, a part drawn on several layers named for each", () => {
  const names = partsProject(set("chibi"), look, STARTER_CLOTHES).pages[0]!.layers.map((l) => l.name);
  for (const part of ["eyes", "mouth"]) assert.ok(names.includes(part), `${part} in ${names}`);
  for (const part of ["base", "hair", "tunic"]) {
    assert.ok(names.filter((n) => n.startsWith(`${part} (`)).length > 1, `${part} in ${names}`);
  }
  assert.equal(new Set(names).size, names.length);
});

test("a part opened alone is just that part, a layer per layer of the game's it's on, on every page of its set", () => {
  const hair = PART_CHOICES.find((c) => c.name === "hair: ponytail")!;
  const project = partAloneProject(hair, set("chibi"), { ...DEFAULT_LOOK, body: "skinny" });
  assert.equal(project.pages.length, 3);
  assert.deepEqual(project.pages[0]!.layers.map((l) => l.name), ["hair: ponytail (hairBack)", "hair: ponytail (hair)"]);
  project.pages.forEach((page, i) => {
    const sketch = set("chibi").pages[i]!.sketch({ ...DEFAULT_LOOK, body: "skinny", hair: "ponytail" }, STARTER_CLOTHES);
    assert.deepEqual(composite(page).rgba, render(sketch, ["hair"]).rgba, page.name);
  });
});

test("every option of the look, and every piece of wear, can be opened alone", () => {
  const names = PART_CHOICES.map((c) => c.name);
  assert.ok(names.includes("base"));
  for (const hair of LOOK_OPTIONS.hair) assert.ok(names.includes(`hair: ${hair}`));
  for (const eyes of LOOK_OPTIONS.eyes) assert.ok(names.includes(`eyes: ${eyes}`));
  for (const mouth of LOOK_OPTIONS.mouth) assert.ok(names.includes(`mouth: ${mouth}`));
  for (const wear of [...Object.keys(STARTER_CLOTHES), "jerkin", "weapon"]) assert.ok(names.includes(wear), wear);
});

test("the bare base alone is the body and face shape with nothing on", () => {
  const base = PART_CHOICES.find((c) => c.name === "base")!;
  const project = partAloneProject(base, set("portrait"), DEFAULT_LOOK);
  const sketch = set("portrait").pages[0]!.sketch(DEFAULT_LOOK, STARTER_CLOTHES);
  const bare = render(sketch, ["base"]);
  assert.deepEqual(composite(project.pages[0]!).rgba, bare.rgba);
});
