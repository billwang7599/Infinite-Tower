import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Color3 } from "@babylonjs/core";
import { moonAt, sunAt, type Vec3 } from "@infinite-tower/shared";
import { daylightAt, directLightAt, MOONLIGHT } from "../../../src/visuals/sky/daylight.js";

const SAMPLES = 20000;
const fractions = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const altitudeDeg = (v: Vec3) => (Math.asin(v.y) * 180) / Math.PI;
const warmth = (c: Color3) => c.r / c.b;

describe("the sky's direct light", () => {
  test("by day it's the sun at full strength, at midnight the moon", () => {
    const noon = directLightAt(0.5);
    assert.equal(noon.body, "sun");
    assert.equal(noon.strength, 1);
    assert.deepEqual(noon.toLight, sunAt(0.5));
    const midnight = directLightAt(0);
    assert.equal(midnight.body, "moon");
    assert.ok(midnight.strength > 0.9);
    assert.deepEqual(midnight.toLight, moonAt(0));
  });

  test("it cross-fades: no jump in strength, and it changes body only while it's dark", () => {
    for (let i = 1; i < fractions.length; i++) {
      const a = directLightAt(fractions[i - 1]!), b = directLightAt(fractions[i]!);
      assert.ok(Math.abs(a.strength - b.strength) < 0.01, `strength jumps at ${fractions[i]}`);
      if (a.body !== b.body) assert.ok(a.strength < 1e-3 && b.strength < 1e-3, `switches lit at ${fractions[i]}`);
      else if (a.strength > 0.01) assert.ok(dot(a.toLight, b.toLight) > 0.9999, `turns fast at ${fractions[i]}`);
    }
  });

  test("night is dim blue moonlight with sky light left over, never black", () => {
    assert.ok(MOONLIGHT.color.b > MOONLIGHT.color.r);
    assert.ok(MOONLIGHT.intensity > 0.2);
    const night = daylightAt(0);
    assert.ok(night.skyLightScale > 0.3);
    assert.ok(night.skyLight.b > night.skyLight.r);
  });

  test("a low sun is warmer than the noon sun", () => {
    const low = fractions.find((f) => f < 0.5 && altitudeDeg(sunAt(f)) > 3)!;
    assert.ok(warmth(daylightAt(low).sunTint) > warmth(daylightAt(0.5).sunTint));
  });
});
