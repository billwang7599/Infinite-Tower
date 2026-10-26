import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ITEM_IDS, ITEMS } from "@infinite-tower/shared";
import { drawItem, ITEM_PX } from "../../src/gfx/items/items.js";

describe("item pictures", () => {
  test("every item has one, ITEM_PX square per bag cell it covers (lying flat)", () => {
    for (const id of ITEM_IDS) {
      const pic = drawItem(id);
      assert.equal(pic.width, ITEMS[id].cols * ITEM_PX, id);
      assert.equal(pic.height, ITEMS[id].rows * ITEM_PX, id);
      assert.equal(pic.rgba.length, pic.width * pic.height * 4, id);
    }
  });

  test("each has something drawn, with see-through around it", () => {
    for (const id of ITEM_IDS) {
      const pic = drawItem(id);
      const alphas = Array.from({ length: pic.width * pic.height }, (_, i) => pic.rgba[i * 4 + 3]);
      const drawn = alphas.filter((a) => a === 255).length;
      assert.ok(drawn > alphas.length * 0.2, `${id}: ${drawn} pixels drawn`);
      assert.equal(alphas[0], 0, `${id}: top-left corner is see-through`);
    }
  });
});
