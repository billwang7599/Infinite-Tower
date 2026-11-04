import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addItem, emptyBag, packFor } from "@infinite-tower/shared";
import { tallyText } from "../../../../src/ui/screens/questbook/tally.js";

describe("a quest step's tally", () => {
  test("items: what the bag and the backpack hold of them, out of what's asked, no more than that", () => {
    const bag = addItem(addItem(emptyBag(), "boar-hide", 1).bag, "boar-meat", 4).bag;
    const pack = addItem(packFor("canvas-backpack"), "boar-hide", 1).bag, quiver = packFor(null);
    assert.equal(tallyText({ item: "boar-hide", need: 3 }, { bag, pack, quiver }), "2 / 3");
    assert.equal(tallyText({ item: "boar-meat", need: 2 }, { bag, pack, quiver }), "2 / 2");
    assert.equal(tallyText({ item: "boar-tusk", need: 2 }, { bag, pack, quiver }), "0 / 2");
  });

  test("kills: as the server counted them", () => {
    const nothing = { bag: emptyBag(), pack: packFor(null), quiver: packFor(null) };
    assert.equal(tallyText({ kills: 1, need: 3 }, nothing), "1 / 3");
  });
});
