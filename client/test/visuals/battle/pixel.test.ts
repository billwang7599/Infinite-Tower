import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DYES, SKIN } from "../../../src/gfx/look/palette.js";
import { LOW_RES_LINES, pixelFlags, pixelScale, rampTones } from "../../../src/visuals/battle/pixel.js";

describe("the pixel-art render's flags", () => {
  test("no flag leaves today's look", () => {
    assert.deepEqual(pixelFlags(""), { scale: null, outline: false, palette: null });
    assert.equal(pixelScale(pixelFlags(""), 768), 1);
  });

  test("each layer turns on by itself", () => {
    assert.deepEqual(pixelFlags("?pixel=4"), { scale: 4, outline: false, palette: null });
    assert.deepEqual(pixelFlags("?outline"), { scale: null, outline: true, palette: null });
    assert.deepEqual(pixelFlags("?palette"), { scale: null, outline: false, palette: "ramps" });
    assert.deepEqual(pixelFlags("?palette=bands"), { scale: null, outline: false, palette: "bands" });
  });

  test("a bare pixel flag picks the scale from the canvas height, a number is taken as it is", () => {
    assert.equal(pixelFlags("?pixel").scale, "auto");
    assert.equal(pixelScale(pixelFlags("?pixel"), LOW_RES_LINES * 3), 3);
    assert.equal(pixelScale(pixelFlags("?pixel"), LOW_RES_LINES / 2), 1);
    assert.equal(pixelScale(pixelFlags("?pixel=5&outline"), 768), 5);
    assert.equal(pixelFlags("?pixel=0").scale, "auto");
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
