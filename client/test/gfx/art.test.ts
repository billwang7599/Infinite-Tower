import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from "@infinite-tower/shared";
import { BATTLE_FACINGS, CHIBI_FACINGS, render, renderParts, type AnySketch, type Picture } from "../../src/gfx/look/art.js";
import { SWORD_POSES, type SwordPose } from "../../src/gfx/look/battle.js";
import { LEATHER_JERKIN } from "../../src/gfx/look/jerkin.js";
import { battleSketch, chibiSketch, portraitSketch } from "../../src/gfx/look/look.js";
import { STARTER_CLOTHES } from "../../src/gfx/look/outfit.js";

const stacked = (pictures: readonly Picture[], width: number, height: number): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(width * height * 4);
  for (const { rgba } of pictures) {
    for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3]) out.set(rgba.subarray(i, i + 4), i);
  }
  return out;
};

const sketches = (look: Look, wear = STARTER_CLOTHES): [string, AnySketch][] => [
  ["portrait", portraitSketch(look, wear)],
  ...CHIBI_FACINGS.map((facing): [string, AnySketch] => [`chibi ${facing}`, chibiSketch(look, facing, wear)]),
  ...BATTLE_FACINGS.flatMap((facing) => (Object.entries(SWORD_POSES) as [SwordPose, number][]).flatMap(([pose, count]) =>
    Array.from({ length: count }, (_, frame): [string, AnySketch] =>
      [`battle ${pose} ${frame} ${facing}`, battleSketch(look, pose, frame, facing, wear)]))),
  ["battle stand left-handed", battleSketch(look, "stand", 0, "back", wear, "leftHand")],
  ["battle down", battleSketch(look, "down", 0, "front", wear)],
];

const looks: Look[] = [
  DEFAULT_LOOK,
  ...LOOK_OPTIONS.body.map((body, i) => ({
    ...DEFAULT_LOOK, body, face: LOOK_OPTIONS.face[i]!, hair: LOOK_OPTIONS.hair[i + 1]!, eyes: LOOK_OPTIONS.eyes[i + 1]!,
    mouth: LOOK_OPTIONS.mouth[i + 1]!,
  })),
];

describe("a picture cut into its parts", () => {
  test("the parts stacked bottom to top are the picture, pixel for pixel", () => {
    for (const look of looks) {
      for (const wear of [STARTER_CLOTHES, { ...STARTER_CLOTHES, jerkin: LEATHER_JERKIN }]) {
        for (const [name, sketch] of sketches(look, wear)) {
          const whole = render(sketch);
          const parts = renderParts(sketch).map((p) => p.picture);
          assert.deepEqual(stacked(parts, whole.width, whole.height), whole.rgba, `${look.body} ${look.hair} ${name}`);
        }
      }
    }
  });

  test("each part is named for what it is: the bare base, the features, then each thing worn", () => {
    const names = new Set(renderParts(battleSketch(DEFAULT_LOOK, "stand", 0, "front")).map((p) => p.part));
    assert.deepEqual([...names].sort(), ["base", "boots", "eyes", "hair", "mouth", "trousers", "tunic", "weapon"]);
  });

  test("a part keeps the pixels a later part covers, so hiding the later one shows it whole", () => {
    const sketch = portraitSketch(DEFAULT_LOOK);
    const base = renderParts(sketch).filter((p) => p.part === "base").map((p) => p.picture);
    const bare = render(sketch, ["base"]);
    const covered = (pics: readonly Picture[]) =>
      Array.from({ length: bare.width * bare.height }, (_, i) => pics.some((pic) => pic.rgba[i * 4 + 3]! > 0));
    assert.deepEqual(covered(base), covered([bare]));
  });

  test("a part drawn alone is drawn on its own, transparent everywhere else", () => {
    const sketch = portraitSketch({ ...DEFAULT_LOOK, hair: "ponytail" });
    const hair = render(sketch, ["hair"]);
    const whole = render(sketch);
    let shown = 0;
    for (let i = 3; i < hair.rgba.length; i += 4) {
      if (!hair.rgba[i]) continue;
      shown++;
      assert.equal(whole.rgba[i], 255);
    }
    assert.ok(shown > 0);
  });
});
