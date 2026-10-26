import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS } from "@infinite-tower/shared";
import { VIEWS, type Art, type Picture } from "../../src/gfx/look/art.js";
import { POSES } from "../../src/gfx/look/battle.js";
import { BODY_TYPES } from "../../src/gfx/look/body.js";
import { LEATHER_JERKIN } from "../../src/gfx/look/jerkin.js";
import { CHIBI_FACINGS, drawBattle, drawChibi, drawPortrait } from "../../src/gfx/look/look.js";
import { STARTER_CLOTHES } from "../../src/gfx/look/outfit.js";

const WEARS: Record<string, readonly Art[]> = {
  "starter clothes": STARTER_CLOTHES,
  "with the jerkin": [...STARTER_CLOTHES, LEATHER_JERKIN],
};

/** Every picture of the default look in `wear`, with the view it's drawn in. */
const pictures = (wear: readonly Art[]) => [
  { name: "portrait", view: VIEWS.portrait, pic: drawPortrait(DEFAULT_LOOK, wear) },
  ...CHIBI_FACINGS.map((facing) => ({
    name: `chibi ${facing}`, view: VIEWS.chibi, pic: drawChibi(DEFAULT_LOOK, facing, wear),
  })),
  ...POSES.map((pose) => ({ name: `battle ${pose}`, view: VIEWS.battle, pic: drawBattle(DEFAULT_LOOK, pose, wear) })),
];

const opaquePixels = (pic: Picture) =>
  Array.from({ length: pic.width * pic.height }, (_, i) => pic.rgba[i * 4 + 3]).filter((a) => a === 255).length;

describe("look pictures", () => {
  test("there are three views: the portrait, the chibi and the battle sprite", () => {
    assert.deepEqual(Object.keys(VIEWS), ["portrait", "chibi", "battle"]);
  });

  for (const [wearName, wear] of Object.entries(WEARS)) {
    test(`each is drawn at its view's size (${wearName})`, () => {
      for (const { name, view, pic } of pictures(wear)) {
        assert.equal(pic.width, view.width, name);
        assert.equal(pic.height, view.height, name);
        assert.equal(pic.rgba.length, pic.width * pic.height * 4, name);
      }
    });

    test(`each has something drawn (${wearName})`, () => {
      for (const { name, pic } of pictures(wear)) assert.ok(opaquePixels(pic) > 0, `${name}: nothing drawn`);
    });
  }
});

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** The pixel's red, green, blue and alpha. */
const at = (pic: Picture, x: number, y: number) => [...pic.rgba.subarray((y * pic.width + x) * 4).subarray(0, 4)];
const brightness = (pic: Picture, x: number, y: number) => at(pic, x, y).slice(0, 3).reduce((a, b) => a + b);
const opaqueColumns = (pic: Picture, y: number) => range(0, pic.width - 1).filter((x) => at(pic, x, y)[3] === 255);

/** The chibi of each body type facing front and back, with the box its frame's legs fill and its middle column. */
const chibiLegs = () => LOOK_OPTIONS.body.flatMap((body) => (["front", "back"] as const).map((facing) => {
  const { legs, middle } = BODY_TYPES[body].chibi[facing];
  const cells = range(0, VIEWS.chibi.width * VIEWS.chibi.height - 1)
    .map((i) => [i % VIEWS.chibi.width, Math.floor(i / VIEWS.chibi.width)] as const)
    .filter(([x, y]) => legs(x, y));
  const [xs, ys] = [cells.map(([x]) => x), cells.map(([, y]) => y)];
  return {
    name: `${body} ${facing}`, pic: drawChibi({ ...DEFAULT_LOOK, body }, facing), middle,
    left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
  };
}));

// The legs used to stand apart under one boot as wide as both, and read as a bench.
describe("the chibi's legs, facing front and back", () => {
  test("they stand together, in boots as wide as they are, the soles a pixel wider each side", () => {
    for (const { name, pic, left, right, top, bottom } of chibiLegs()) {
      for (const y of range(top, bottom)) {
        assert.deepEqual(opaqueColumns(pic, y), range(left, right), `${name}, row ${y}`);
      }
      assert.deepEqual(opaqueColumns(pic, bottom + 1), range(left - 1, right + 1), `${name}, the soles`);
    }
  });

  test("the right one is in shadow, with a dark line where they meet", () => {
    for (const { name, pic, middle, top, bottom } of chibiLegs()) {
      for (const [part, y] of [["trousers", top], ["boots", bottom]] as const) {
        const [left, line, right] = [-1, 0, 1].map((dx) => brightness(pic, middle + dx, y));
        assert.ok(left! > right! && right! > line!, `${name}, ${part}: ${left} > ${right} > ${line}`);
      }
    }
  });
});
