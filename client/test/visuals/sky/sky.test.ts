import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Color3, NullEngine, PointLight, Scene, StandardMaterial } from "@babylonjs/core";
import { moonAt, sunAt, type Vec3 } from "@infinite-tower/shared";
import {
  blobShadowOf, createSky, directLightAt, daylightAt, MAX_MAP_LIGHTS, MOONLIGHT, nearestLights, SHADOW_MAP_LIGHTS,
  SHADOW_SWAP_MARGIN_M, type MapLight,
} from "../../../src/visuals/sky/sky.js";
import { ARENA_LOOKS } from "../../../src/visuals/arenas/index.js";

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

describe("a sprite's blob shadow", () => {
  test("falls away from the light, longer when the light is low", () => {
    const noon = blobShadowOf(directLightAt(0.5));
    const low = blobShadowOf(directLightAt(fractions.find((f) => f > 0.5 && altitudeDeg(sunAt(f)) < 12)!));
    assert.ok(low.stretch > noon.stretch && noon.stretch >= 1);
    const light = directLightAt(0.7);
    const { offsetM } = blobShadowOf(light);
    assert.ok(offsetM.x * light.toLight.x + offsetM.z * light.toLight.z < 0);
  });

  test("with no direct light it's a plain round one, faint", () => {
    const dark = blobShadowOf({ body: "sun", toLight: { x: 1, y: 0.01, z: 0 }, strength: 0 });
    assert.equal(dark.stretch, 1);
    assert.deepEqual(dark.offsetM, { x: 0, z: 0 });
    assert.ok(dark.alpha < blobShadowOf(directLightAt(0.5)).alpha);
  });
});

describe("map lights", () => {
  const spots: Vec3[] = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }];

  test("the nearest ones are picked, and a picked one is kept until another is clearly nearer", () => {
    assert.deepEqual(nearestLights(spots, { x: 9, y: 0, z: 0 }, 2, []), [0, 1]);
    const at = { x: 15 + SHADOW_SWAP_MARGIN_M / 4, y: 0, z: 0 };
    assert.deepEqual(nearestLights(spots, at, 1, [1]), [1]);
    assert.deepEqual(nearestLights(spots, { x: 20, y: 0, z: 0 }, 1, [1]), [2]);
  });

  test("the sky owner makes them point lights; only the ones nearest the camera cast shadows", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const lights: MapLight[] = spots.map((at) => ({ at, color: new Color3(0.3, 1, 0.8), intensity: 1, rangeM: 6,
      flicker: 0.1 }));
    sky.look(ARENA_LOOKS.mire.env, lights);
    sky.frame(0, { x: 21, y: 2, z: 0 });
    const points = scene.lights.filter((l): l is PointLight => l instanceof PointLight);
    assert.equal(points.length, Math.min(spots.length, MAX_MAP_LIGHTS));
    const shadowed = points.filter((l) => l.shadowEnabled).map((l) => l.position.x).sort((a, b) => a - b);
    assert.equal(shadowed.length, SHADOW_MAP_LIGHTS);
    const camera = { x: 21, y: 2, z: 0 };
    const nearest = [...spots].sort((a, b) => Math.abs(a.x - camera.x) - Math.abs(b.x - camera.x))
      .slice(0, SHADOW_MAP_LIGHTS).map((s) => s.x).sort((a, b) => a - b);
    assert.deepEqual(shadowed, nearest);
    sky.look(ARENA_LOOKS.mire.env, []);
    assert.equal(scene.lights.filter((l) => l instanceof PointLight).length, 0);
    scene.dispose();
  });

  test("every lit material takes the sky's lights and the map's", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const m = new StandardMaterial("m", scene);
    sky.frame(0, { x: 0, y: 2, z: 0 });
    assert.ok(m.maxSimultaneousLights >= 2 + MAX_MAP_LIGHTS);
    scene.dispose();
  });
});
