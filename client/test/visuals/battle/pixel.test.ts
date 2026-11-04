import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DYES, SKIN } from "../../../src/gfx/look/palette.js";
import {
  DEFAULT_PIXEL_SCALE, LOW_RES_LINES, pixelFlags, pixelScale, rampTones,
} from "../../../src/visuals/battle/pixel.js";

describe("the pixel-art render's flags", () => {
  test("by default the arena is pixel art with outlines, anti-aliased, its people 3D", () => {
    assert.deepEqual(pixelFlags(""), {
      scale: DEFAULT_PIXEL_SCALE, outline: true, palette: null, player3d: true, steps: null, aa: true,
    });
    assert.equal(pixelScale(pixelFlags(""), 768), DEFAULT_PIXEL_SCALE);
  });

  test("each layer changes by itself", () => {
    const byDefault = pixelFlags("");
    assert.deepEqual(pixelFlags("?pixel=4"), { ...byDefault, scale: 4 });
    assert.deepEqual(pixelFlags("?outline=0"), { ...byDefault, outline: false });
    assert.deepEqual(pixelFlags("?palette"), { ...byDefault, palette: "ramps" });
    assert.deepEqual(pixelFlags("?palette=bands"), { ...byDefault, palette: "bands" });
    assert.deepEqual(pixelFlags("?player3d=0"), { ...byDefault, player3d: false });
    assert.deepEqual(pixelFlags("?steps=12"), { ...byDefault, steps: 12 });
    assert.deepEqual(pixelFlags("?aa=0"), { ...byDefault, aa: false });
  });

  test("the old look is still a URL away", () => {
    assert.deepEqual(pixelFlags("?pixel=1&outline=0&player3d=0"), {
      scale: null, outline: false, palette: null, player3d: false, steps: null, aa: true,
    });
  });

  test("pixel=auto picks the scale from the canvas height, a number above 1 is taken as it is, 1 or 0 is off", () => {
    assert.equal(pixelFlags("?pixel=auto").scale, "auto");
    assert.equal(pixelFlags("?pixel").scale, "auto");
    assert.equal(pixelScale(pixelFlags("?pixel=auto"), LOW_RES_LINES * 3), 3);
    assert.equal(pixelScale(pixelFlags("?pixel=auto"), LOW_RES_LINES / 2), 1);
    assert.equal(pixelScale(pixelFlags("?pixel=5"), 768), 5);
    assert.equal(pixelFlags("?pixel=1").scale, null);
    assert.equal(pixelFlags("?pixel=0").scale, null);
    assert.equal(pixelScale(pixelFlags("?pixel=1"), 768), 1);
  });

  test("outline, player3d and aa are on unless set to 0", () => {
    assert.equal(pixelFlags("?outline").outline, true);
    assert.equal(pixelFlags("?outline=1").outline, true);
    assert.equal(pixelFlags("?player3d").player3d, true);
    assert.equal(pixelFlags("?aa").aa, true);
    assert.equal(pixelFlags("?aa=1").aa, true);
  });

  test("steps needs a rate above zero", () => {
    assert.equal(pixelFlags("?steps").steps, null);
    assert.equal(pixelFlags("?steps=0").steps, null);
    assert.equal(pixelFlags("?steps=8").steps, 8);
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
