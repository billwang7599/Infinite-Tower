import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Color3 } from "@babylonjs/core";
import { HAZE_SHARES, hazed } from "../../../src/visuals/arenas/parts.js";

describe("far props in haze", () => {
  test("each further ring is lit less and glows nearer the sky's colour", () => {
    const pine = new Color3(0.1, 0.19, 0.15), sky = new Color3(0.33, 0.29, 0.31);
    const rings = HAZE_SHARES.map((share) => hazed(pine, sky, share));
    const off = (c: Color3) => Math.abs(c.r / (c.g || 1) - sky.r / sky.g);
    for (let i = 1; i < rings.length; i++) {
      assert.ok(rings[i]!.diffuse.toLuminance() < rings[i - 1]!.diffuse.toLuminance(), "lit less");
      assert.ok(rings[i]!.emissive.toLuminance() > rings[i - 1]!.emissive.toLuminance(), "glows more");
      assert.ok(off(rings[i]!.emissive) < off(rings[i - 1]!.emissive), "nearer the sky's hue");
    }
    const lit = rings[0]!.diffuse.add(rings[0]!.emissive);
    assert.ok(Math.abs(lit.g - (pine.g + (sky.g - pine.g) * HAZE_SHARES[0])) < 1e-6, "fully lit, its hazed colour");
  });
});
