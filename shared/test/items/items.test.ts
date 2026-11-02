import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ITEM_IDS, ITEMS, RARITIES, UNIQUE_ITEMS, type ItemId } from "@infinite-tower/shared";

describe("rarity", () => {
  test("every item kind has one of the tiers", () => {
    for (const id of ITEM_IDS) assert.ok(RARITIES.includes(ITEMS[id].rarity), id);
  });

  test("everyday things are common, and the rarer weapons and essences uncommon", () => {
    const common: ItemId[] = ["boar-meat", "bread", "copper-coin", "boar-hide", "wolf-fang", "sword", "boar-essence"];
    const uncommon: ItemId[] = ["health-potion", "longsword", "greatsword", "lurker-scale", "kobold-swordsman-essence"];
    for (const id of common) assert.equal(ITEMS[id].rarity, "common", id);
    for (const id of uncommon) assert.equal(ITEMS[id].rarity, "uncommon", id);
  });

  test("there's a sigil of every tier above common, each naming its own inscription", () => {
    const sigils = ITEM_IDS.filter((id) => "inscription" in ITEMS[id]);
    for (const tier of RARITIES.filter((r) => r !== "common")) {
      assert.ok(sigils.some((id) => ITEMS[id].rarity === tier), tier);
    }
    const inscriptions = sigils.map((id) => (ITEMS[id] as { inscription: string }).inscription);
    assert.equal(new Set(inscriptions).size, sigils.length);
  });

  test("unique things don't stack, so there's only ever one", () => {
    assert.ok(UNIQUE_ITEMS.length > 0);
    for (const id of UNIQUE_ITEMS) {
      assert.equal(ITEMS[id].rarity, "unique");
      assert.equal(ITEMS[id].stackSize, 1, id);
    }
  });
});
