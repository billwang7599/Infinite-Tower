import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS } from "@infinite-tower/shared";
import { HAIR, SKIN, EYES } from "../../../../src/gfx/look/palette.js";
import { BASE, DEEP, LIGHT } from "../../../../src/gfx/look/pixels.js";
import { FACE, faceTexels, HAIR_TEXELS, hairTexels } from "../../../../src/visuals/battle/person/head.js";

const at = (pic: { width: number; rgba: Uint8ClampedArray }, x: number, y: number) => {
  const i = (y * pic.width + x) * 4;
  return `#${[0, 1, 2].map((c) => pic.rgba[i + c]!.toString(16).padStart(2, "0")).join("")}`;
};
const colours = (pic: { width: number; height: number; rgba: Uint8ClampedArray }) => {
  const all = new Set<string>();
  for (let y = 0; y < pic.height; y++) for (let x = 0; x < pic.width; x++) all.add(at(pic, x, y));
  return all;
};

describe("the 3D head's face", () => {
  test("is the chibi's face on skin: its edges are bare skin for the sides and back of the head", () => {
    const face = faceTexels(DEFAULT_LOOK), skin = SKIN[DEFAULT_LOOK.skin][BASE];
    assert.equal(face.width, FACE.size);
    for (let i = 0; i < FACE.size; i++) {
      for (const [x, y] of [[0, i], [FACE.size - 1, i], [i, 0], [i, FACE.size - 1]] as const) {
        assert.equal(at(face, x, y), skin);
      }
    }
  });

  test("carries the creator's choices: eye colour, eye type, mouth, skin", () => {
    const face = faceTexels({ ...DEFAULT_LOOK, eyeColor: "red" });
    assert.ok([...colours(face)].some((c) => (EYES.red as readonly string[]).includes(c)), "red irises");
    const kinds = (part: "eyes" | "mouth") => new Set(LOOK_OPTIONS[part].map((o) =>
      Buffer.from(faceTexels({ ...DEFAULT_LOOK, [part]: o }).rgba).toString("base64")));
    assert.equal(kinds("eyes").size, LOOK_OPTIONS.eyes.length);
    assert.equal(kinds("mouth").size, LOOK_OPTIONS.mouth.length);
    assert.equal(at(faceTexels({ ...DEFAULT_LOOK, skin: "dark" }), 0, 0), SKIN.dark[BASE]);
  });
});

describe("hair's strands", () => {
  test("are the hair's own tones, a dark strand line and a shine, so light hair isn't one flat block", () => {
    const pic = hairTexels(HAIR.silver), tones = colours(pic);
    assert.equal(pic.width * pic.height, HAIR_TEXELS.width * HAIR_TEXELS.height);
    for (const tone of [DEEP, BASE, LIGHT] as const) assert.ok(tones.has(HAIR.silver[tone]), `tone ${tone}`);
    for (const c of tones) assert.ok((HAIR.silver as readonly string[]).includes(c), c);
  });
});
