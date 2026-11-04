import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Color3 } from "@babylonjs/core";
import { moonAt, sunAt, type Vec3 } from "@infinite-tower/shared";
import { REGION_LOOKS } from "../../../src/visuals/regions/index.js";
import { daylightAt, directLightAt } from "../../../src/visuals/sky/daylight.js";

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
    for (const { env: { moon } } of Object.values(REGION_LOOKS)) {
      assert.ok(moon.color.b > moon.color.r);
      assert.ok(moon.intensity > 0.2 && moon.nightFill >= 1);
    }
    const night = daylightAt(0);
    assert.ok(night.skyLightScale > 0.3);
    assert.ok(night.skyLight.b > night.skyLight.r);
  });

  test("a low sun is warmer than the noon sun", () => {
    const low = fractions.find((f) => f < 0.5 && altitudeDeg(sunAt(f)) > 3)!;
    assert.ok(warmth(daylightAt(low).sunTint) > warmth(daylightAt(0.5).sunTint));
  });
});

describe("the sky's colours", () => {
  const luminance = (c: Color3) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  test("by day the sky overhead is bluer than at the horizon, and at night darker than by day", () => {
    const noon = daylightAt(0.5).zenith, night = daylightAt(0).zenith;
    assert.ok(noon.b > 1 && noon.b > noon.r);
    assert.ok(luminance(night) < luminance(noon));
  });

  test("the sun's glow is strongest low in the sky, still there at noon, and gone at night", () => {
    const low = fractions.find((f) => f < 0.5 && altitudeDeg(sunAt(f)) > 3)!;
    assert.ok(daylightAt(low).glow > daylightAt(0.5).glow);
    assert.ok(daylightAt(0.5).glow > 0);
    assert.equal(daylightAt(0).glow, 0);
  });

  test("the glow fades in and out with no jump", () => {
    for (let i = 1; i < fractions.length; i++) {
      assert.ok(Math.abs(daylightAt(fractions[i - 1]!).glow - daylightAt(fractions[i]!).glow) < 0.01);
    }
  });
});
