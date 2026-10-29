import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DAY_LENGTH_MS, dayFraction, moonAt, retimeDay, sunAt, timeOfDay, WALL_CLOCK, type Vec3,
} from "@infinite-tower/shared";

const SAMPLES = 2880;
const fractions = Array.from({ length: SAMPLES }, (_, i) => i / SAMPLES);
const altitudeDeg = (v: Vec3) => (Math.asin(v.y) * 180) / Math.PI;
const share = (pick: (f: number) => boolean) => fractions.filter(pick).length / SAMPLES;

/** The fraction where `body` crosses the horizon going `up` (or down). */
function crossing(body: (f: number) => Vec3, up: boolean): number {
  for (let i = 0; i < SAMPLES; i++) {
    const a = body(fractions[i]!).y, b = body(fractions[(i + 1) % SAMPLES]!).y;
    if (up ? a <= 0 && b > 0 : a > 0 && b <= 0) return fractions[i]!;
  }
  throw new Error("never crosses");
}

describe("the day clock", () => {
  test("the wall clock runs one day per DAY_LENGTH_MS, wrapping to 0..1", () => {
    assert.equal(timeOfDay(0), 0);
    assert.equal(timeOfDay(DAY_LENGTH_MS / 2), 0.5);
    assert.equal(timeOfDay(DAY_LENGTH_MS * 3 + DAY_LENGTH_MS / 4), 0.25);
    assert.ok(Math.abs(dayFraction(WALL_CLOCK, 7 * DAY_LENGTH_MS + 1000) - timeOfDay(1000)) < 1e-9);
  });

  test("speed changes how fast it runs from now, with no jump", () => {
    const now = 5 * DAY_LENGTH_MS + 1234;
    const fast = retimeDay(WALL_CLOCK, now, { speed: 10 });
    assert.ok(Math.abs(dayFraction(fast, now) - timeOfDay(now)) < 1e-9);
    const later = now + DAY_LENGTH_MS / 100;
    assert.ok(Math.abs(dayFraction(fast, later) - (timeOfDay(now) + 0.1)) < 1e-9);
  });

  test("an offset jumps the day ahead from where it is; a fraction sets it; speed 0 freezes it", () => {
    const now = 1000;
    const ahead = retimeDay(WALL_CLOCK, now, { offsetFraction: 0.25 });
    assert.ok(Math.abs(dayFraction(ahead, now) - (timeOfDay(now) + 0.25)) < 1e-9);
    const frozen = retimeDay(ahead, now, { fraction: 0.75, speed: 0 });
    assert.equal(dayFraction(frozen, now + DAY_LENGTH_MS / 3), 0.75);
    const wrapped = retimeDay(frozen, now, { offsetFraction: 0.5 });
    assert.equal(dayFraction(wrapped, now), 0.25);
  });
});

describe("the sun and the moon", () => {
  test("their directions are unit vectors", () => {
    for (const f of [0, 0.2, 0.5, 0.8]) {
      for (const v of [sunAt(f), moonAt(f)]) assert.ok(Math.abs(Math.hypot(v.x, v.y, v.z) - 1) < 1e-9);
    }
  });

  test("the sun rises in the east, peaks in the south at noon (not overhead) and sets in the west", () => {
    assert.ok(sunAt(crossing(sunAt, true)).x > 0.5, "rises east");
    assert.ok(sunAt(crossing(sunAt, false)).x < -0.5, "sets west");
    const noon = sunAt(0.5);
    assert.ok(Math.abs(noon.x) < 1e-9 && noon.z < 0, "south at noon");
    assert.ok(altitudeDeg(noon) > 40 && altitudeDeg(noon) < 75, `noon altitude ${altitudeDeg(noon)}`);
    for (const f of fractions) assert.ok(sunAt(f).y <= noon.y + 1e-9);
    assert.ok(sunAt(0).y < 0, "below the horizon at midnight");
  });

  test("about 60% of the day is daylight, about 30% full night, the rest dawn and dusk", () => {
    const day = share((f) => altitudeDeg(sunAt(f)) > 0);
    const night = share((f) => altitudeDeg(sunAt(f)) < -6);
    assert.ok(day > 0.55 && day < 0.68, `day ${day}`);
    assert.ok(night > 0.25 && night < 0.35, `night ${night}`);
  });

  test("the moon is roughly opposite the sun: up at midnight in the south, rising east and setting west", () => {
    const midnight = moonAt(0);
    assert.ok(midnight.y > 0 && midnight.z < 0);
    assert.ok(moonAt(0.5).y < 0);
    assert.ok(moonAt(crossing(moonAt, true)).x > 0.5, "rises east");
    assert.ok(moonAt(crossing(moonAt, false)).x < -0.5, "sets west");
    for (const f of [0, 0.25, 0.5, 0.75]) {
      const s = sunAt(f), m = moonAt(f);
      assert.ok(s.x * m.x + s.y * m.y + s.z * m.z < 0, `apart at ${f}`);
    }
  });
});
