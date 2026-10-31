import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addItem, emptyBag } from "@infinite-tower/shared";
import { tallyText } from "../../../../src/ui/screens/questbook/tally.js";

describe("a quest step's tally", () => {
  test("items: what the bag holds of them, out of what's asked, no more than that", () => {
    const bag = addItem(addItem(emptyBag(), "boar-hide", 1).bag, "boar-meat", 4).bag;
    assert.equal(tallyText({ item: "boar-hide", need: 2 }, bag), "1 / 2");
    assert.equal(tallyText({ item: "boar-meat", need: 2 }, bag), "2 / 2");
    assert.equal(tallyText({ item: "boar-tusk", need: 2 }, bag), "0 / 2");
  });

  test("kills: as the server counted them", () => {
    assert.equal(tallyText({ kills: 1, need: 3 }, emptyBag()), "1 / 3");
  });
});
