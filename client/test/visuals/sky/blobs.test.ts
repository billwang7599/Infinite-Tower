import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sunAt, type Vec3 } from "@infinite-tower/shared";
import { blobShadowsAt, type BlobShadow, type Lighting } from "../../../src/visuals/sky/blobs.js";

const SAMPLES = 20000;
const fractions = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES);
const altitudeDeg = (v: Vec3) => (Math.asin(v.y) * 180) / Math.PI;

describe("a sprite's blob shadows", () => {
  const ground = { x: 0, y: 0, z: 0 }, centreM = 0.8;
  const noonSun = { toLight: sunAt(0.5), brightness: 1 };
  const fire = (x: number, brightness = 1.5) => ({ at: { x, y: 1.2, z: 0 }, brightness, rangeM: 10 });
  const lit = (direct: Lighting["direct"], lamps: Lighting["lamps"] = []): Lighting =>
    ({ skyBrightness: 0.4, direct, lamps });
  const away = (s: BlobShadow) => ({ x: s.shift.x, z: s.shift.z });
  const [contactUnderSun, sunCast] = blobShadowsAt(ground, centreM, lit(noonSun));

  test("under the sky alone it's one round contact shadow, centred", () => {
    const only = blobShadowsAt(ground, centreM, lit({ toLight: sunAt(0.5), brightness: 0 }));
    assert.equal(only.length, 1);
    assert.equal(only[0]!.stretch, 1);
    assert.deepEqual(only[0]!.shift, { x: 0, z: 0 });
    assert.deepEqual(contactUnderSun, only[0]);
  });

  test("each light that reaches the ground there casts its own, away from it", () => {
    const casts = blobShadowsAt(ground, centreM, lit(noonSun, [fire(2)]));
    assert.equal(casts.length, 3);
    const sun = sunAt(0.5), fromFire = away(casts[2]!);
    assert.ok(away(casts[1]!).x * sun.x + away(casts[1]!).z * sun.z < 0);
    assert.ok(fromFire.x < 0 && Math.abs(fromFire.z) < 1e-9);
    assert.equal(blobShadowsAt(ground, centreM, lit(noonSun, [fire(12)])).length, 2);
  });

  test("its near end stays under the sprite: it shifts away by half the extra length", () => {
    for (const cast of blobShadowsAt(ground, centreM, lit(noonSun, [fire(3)])).slice(1)) {
      assert.ok(Math.abs(Math.hypot(cast.shift.x, cast.shift.z) - (cast.stretch - 1) / 2) < 1e-9);
    }
  });

  test("a lower light casts a longer one", () => {
    const low = fractions.find((f) => f > 0.5 && altitudeDeg(sunAt(f)) < 12)!;
    const lowCast = blobShadowsAt(ground, centreM, lit({ toLight: sunAt(low), brightness: 1 }))[1]!;
    assert.ok(lowCast.stretch > sunCast!.stretch && sunCast!.stretch >= 1);
  });

  test("each is as dark as its light's share of the light there", () => {
    const fireAt = (x: number, b?: number, direct = noonSun) =>
      blobShadowsAt(ground, centreM, lit(direct, [fire(x, b)])).at(-1)!.alpha;
    assert.ok(fireAt(1.5) > fireAt(4));
    assert.ok(fireAt(2, 1.8) > fireAt(2, 1.2), "a flicker up darkens it");
    const moon = { toLight: sunAt(0.5), brightness: 0.2 };
    assert.ok(fireAt(2, 1.5, moon) > fireAt(2), "a fire's shadow is stronger at night");
    const moonCast = blobShadowsAt(ground, centreM, lit(moon, [fire(2)]))[1]!;
    assert.ok(moonCast.alpha < fireAt(2, 1.5, moon), "by a fire the moon's is the fainter");
    assert.ok(moonCast.alpha < sunCast!.alpha);
    const all = blobShadowsAt(ground, centreM, { skyBrightness: 0, direct: noonSun, lamps: [fire(0.5, 99)] });
    for (const s of all) assert.ok(s.alpha > 0 && s.alpha <= 1);
  });
});
