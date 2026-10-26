import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK } from "@infinite-tower/shared";
import { VIEWS, type Art, type Picture } from "../../src/gfx/look/art.js";
import { POSES } from "../../src/gfx/look/battle.js";
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
