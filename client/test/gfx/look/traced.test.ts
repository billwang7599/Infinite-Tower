import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { distance, outside, readPng, source, SOURCES } from "../../../scripts/trace-portraits.js";
import { VIEWS } from "../../../src/gfx/look/art.js";
import { TRACED_COLORS, TRACED_PICTURES } from "../../../src/gfx/look/base.js";
import { drawTraced } from "../../../src/gfx/look/look.js";

const MAX_SILHOUETTE_MISMATCH = 0.02;
const MAX_MEAN_DISTANCE = { hair: 70, other: 35 };

test("base.ts is what the converter makes of the Stable Diffusion pictures", () => {
  const file = readFileSync(new URL("../../../src/gfx/look/base.ts", import.meta.url), "utf8");
  assert.equal(file, source());
});

describe("each look option, drawn from base.ts, matches the picture it was traced from", () => {
  for (const [part, pictures] of Object.entries(TRACED_PICTURES) as [keyof typeof TRACED_PICTURES, object][]) {
    for (const [option, name] of Object.entries(pictures) as [string, string][]) {
      test(`${part} ${option}`, () => {
        const drawn = drawTraced(part, option, TRACED_COLORS);
        const picture = readPng(`${SOURCES}${name}.png`), background = outside(picture);
        const rgb = (a: ArrayLike<number>, i: number) => [a[i * 4]!, a[i * 4 + 1]!, a[i * 4 + 2]!] as const;
        const size = VIEWS.portrait.width * VIEWS.portrait.height;
        let mismatched = 0;
        const distances: number[] = [];
        for (let i = 0; i < size; i++) {
          const opaque = drawn.rgba[i * 4 + 3]! > 0;
          if (opaque !== !background[i]) mismatched++;
          else if (opaque) distances.push(distance(rgb(drawn.rgba, i), rgb(picture.rgba, i)));
        }
        const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        assert.ok(mismatched / size <= MAX_SILHOUETTE_MISMATCH, `${mismatched} pixels in or out of the outline`);
        const max = part === "hair" ? MAX_MEAN_DISTANCE.hair : MAX_MEAN_DISTANCE.other;
        assert.ok(mean <= max, `colors off by ${mean}`);
      });
    }
  }
});
