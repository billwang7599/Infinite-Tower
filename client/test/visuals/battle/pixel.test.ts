import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DYES, SKIN } from "../../../src/gfx/look/palette.js";
import { LOW_RES_LINES, pixelFlags, pixelScale, rampTones } from "../../../src/visuals/battle/pixel.js";

describe("the pixel-art render's flags", () => {
  test("no flag leaves today's look", () => {
    assert.deepEqual(pixelFlags(""), { scale: null, outline: false, palette: null, player3d: false, steps: null });
    assert.equal(pixelScale(pixelFlags(""), 768), 1);
  });

  test("each layer turns on by itself", () => {
    const none = pixelFlags("");
    assert.deepEqual(pixelFlags("?pixel=4"), { ...none, scale: 4 });
    assert.deepEqual(pixelFlags("?outline"), { ...none, outline: true });
    assert.deepEqual(pixelFlags("?palette"), { ...none, palette: "ramps" });
    assert.deepEqual(pixelFlags("?palette=bands"), { ...none, palette: "bands" });
    assert.deepEqual(pixelFlags("?player3d"), { ...none, player3d: true });
    assert.deepEqual(pixelFlags("?steps=12"), { ...none, steps: 12 });
  });

  test("a bare pixel flag picks the scale from the canvas height, a number is taken as it is", () => {
    assert.equal(pixelFlags("?pixel").scale, "auto");
    assert.equal(pixelScale(pixelFlags("?pixel"), LOW_RES_LINES * 3), 3);
    assert.equal(pixelScale(pixelFlags("?pixel"), LOW_RES_LINES / 2), 1);
    assert.equal(pixelScale(pixelFlags("?pixel=5&outline"), 768), 5);
    assert.equal(pixelFlags("?pixel=0").scale, "auto");
  });

  test("steps needs a rate above zero", () => {
    assert.equal(pixelFlags("?steps").steps, null);
    assert.equal(pixelFlags("?steps=0").steps, null);
    assert.equal(pixelFlags("?steps=8&player3d").steps, 8);
  });
});

describe("the palette the colours snap to", () => {
  test("holds every ramp's tones once, as 0-1 channels", () => {
    const tones = rampTones();
    const keys = tones.map((t) => t.join());
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.includes([0xfd / 255, 0xe8 / 255, 0xde / 255].join()), SKIN.porcelain[3]);
    assert.ok(keys.includes([0x09 / 255, 0x09 / 255, 0x0c / 255].join()), DYES.soot[0]);
    assert.ok(tones.flat().every((c) => c >= 0 && c <= 1));
  });
});
