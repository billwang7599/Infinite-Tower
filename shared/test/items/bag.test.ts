import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addItem, bagCounts, bagProblems, bagWeight, emptyBag, fits, footprint, itemAt, ITEMS, moveItem, BASE_BAG,
  stackSizeIn, takeAt, type Bag, type BagItem, type ItemId,
} from "@infinite-tower/shared";

const MEAT_STACK = ITEMS["boar-meat"].stackSize;

/** A bag of the given size holding `items`. */
const bag = (cols: number, rows: number, ...items: BagItem[]): Bag => ({ cols, rows, items });
const stack = (item: ItemId, x: number, y: number, count = 1, turned = false): BagItem =>
  ({ item, count, x, y, turned });

/** Deep-frozen, so a function that changes its input throws. */
function frozen(b: Bag): Bag {
  b.items.forEach((s) => Object.freeze(s));
  Object.freeze(b.items);
  return Object.freeze(b);
}

describe("item sizes", () => {
  test("every item covers a whole number of cells, and stacks of more than one are single cells", () => {
    for (const [id, def] of Object.entries(ITEMS)) {
      assert.ok(Number.isInteger(def.cols) && def.cols >= 1, id);
      assert.ok(Number.isInteger(def.rows) && def.rows >= 1, id);
      assert.ok(Number.isInteger(def.stackSize) && def.stackSize >= 1, id);
      if (def.stackSize > 1) assert.equal(def.cols * def.rows, 1, `${id} stacks, so it's one cell`);
      assert.ok(def.weight > 0, id);
    }
  });

  test("a hide is light for its size and a tusk is heavy for its size", () => {
    const perCell = (id: ItemId) => ITEMS[id].weight / (ITEMS[id].cols * ITEMS[id].rows);
    assert.ok(perCell("boar-hide") < perCell("boar-tusk"));
  });

  test("turning swaps an item's columns and rows", () => {
    const { cols, rows } = ITEMS["boar-tusk"];
    assert.deepEqual(footprint("boar-tusk", false), { cols, rows });
    assert.deepEqual(footprint("boar-tusk", true), { cols: rows, rows: cols });
  });
});

describe("emptyBag", () => {
  test("is the base bag's size, with nothing in it", () => {
    assert.deepEqual(emptyBag(), { cols: BASE_BAG.cols, rows: BASE_BAG.rows, items: [] });
  });

  test("is a new bag each time", () => {
    assert.notEqual(emptyBag().items, emptyBag().items);
  });
});

describe("itemAt", () => {
  test("finds the stack covering a cell, from any of its cells", () => {
    const b = bag(4, 4, stack("boar-meat", 0, 0), stack("boar-hide", 1, 1));
    assert.equal(itemAt(b, { x: 0, y: 0 }), 0);
    for (const cell of [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }]) {
      assert.equal(itemAt(b, cell), 1);
    }
  });

  test("is -1 on an empty cell", () => {
    assert.equal(itemAt(bag(4, 4, stack("boar-hide", 1, 1)), { x: 3, y: 3 }), -1);
  });

  test("a turned item covers its turned shape", () => {
    const b = bag(4, 4, stack("boar-tusk", 0, 0, 1, true));
    const { cols, rows } = footprint("boar-tusk", true);
    assert.equal(itemAt(b, { x: cols - 1, y: rows - 1 }), 0);
    assert.equal(itemAt(b, { x: cols, y: 0 }), -1);
    assert.equal(itemAt(b, { x: 0, y: rows }), -1);
  });
});

describe("fits", () => {
  const b = bag(4, 3, stack("boar-hide", 0, 0));

  test("on empty cells inside the bag", () => {
    assert.equal(fits(b, "boar-hide", { x: 2, y: 0 }, false), true);
    assert.equal(fits(b, "boar-meat", { x: 3, y: 2 }, false), true);
  });

  test("not over another item", () => {
    assert.equal(fits(b, "boar-hide", { x: 1, y: 1 }, false), false);
  });

  test("not hanging out of the bag, on any side", () => {
    assert.equal(fits(b, "boar-hide", { x: 3, y: 0 }, false), false);
    assert.equal(fits(b, "boar-hide", { x: 2, y: 2 }, false), false);
    assert.equal(fits(b, "boar-meat", { x: -1, y: 0 }, false), false);
    assert.equal(fits(b, "boar-meat", { x: 0, y: -1 }, false), false);
  });

  test("not between cells", () => {
    assert.equal(fits(b, "boar-meat", { x: 2.5, y: 0 }, false), false);
  });

  test("turning can make it fit", () => {
    const flat = bag(3, 1);
    assert.equal(fits(flat, "boar-tusk", { x: 0, y: 0 }, false), false);
    assert.equal(fits(flat, "boar-tusk", { x: 0, y: 0 }, true), true);
  });

  test("an ignored stack (the one being moved) doesn't get in the way", () => {
    assert.equal(fits(b, "boar-hide", { x: 1, y: 0 }, false, 0), true);
  });
});

describe("addItem", () => {
  test("puts an item in the top-left corner of an empty bag", () => {
    const { bag: next, left } = addItem(emptyBag(), "boar-hide", 1);
    assert.equal(left, 0);
    assert.deepEqual(next.items, [stack("boar-hide", 0, 0)]);
  });

  test("fills the top row left to right, then the next row", () => {
    let b = bag(3, 2);
    for (let i = 0; i < 4; i++) b = addItem(b, "boar-meat", MEAT_STACK).bag;
    assert.deepEqual(b.items.map((s) => [s.x, s.y]), [[0, 0], [1, 0], [2, 0], [0, 1]]);
  });

  test("tops up a stack of the same item before starting a new one", () => {
    const b = bag(3, 1, stack("boar-meat", 2, 0, MEAT_STACK - 1));
    const { bag: next, left } = addItem(b, "boar-meat", 3);
    assert.equal(left, 0);
    assert.deepEqual(next.items, [stack("boar-meat", 2, 0, MEAT_STACK), stack("boar-meat", 0, 0, 2)]);
  });

  test("splits more than a stack into several stacks", () => {
    const { bag: next } = addItem(bag(3, 1), "boar-meat", MEAT_STACK + 1);
    assert.deepEqual(next.items.map((s) => s.count), [MEAT_STACK, 1]);
  });

  test("turns an item when that's the only way it fits", () => {
    assert.ok(ITEMS["boar-tusk"].rows > 1, "a tusk is taller than one row");
    const { bag: next, left } = addItem(bag(3, 1), "boar-tusk", 1);
    assert.equal(left, 0);
    assert.deepEqual(next.items, [stack("boar-tusk", 0, 0, 1, true)]);
  });

  test("what doesn't fit is left over, and the bag keeps what it had", () => {
    const full = bag(2, 2, stack("boar-hide", 0, 0));
    const { bag: next, left } = addItem(full, "boar-tusk", 2);
    assert.equal(left, 2);
    assert.deepEqual(next, full);
  });

  test("fits what it can and leaves the rest", () => {
    const { bag: next, left } = addItem(bag(1, 1), "boar-meat", MEAT_STACK + 2);
    assert.equal(left, 2);
    assert.deepEqual(next.items, [stack("boar-meat", 0, 0, MEAT_STACK)]);
  });

  test("doesn't change its input", () => {
    const b = frozen(bag(3, 3, stack("boar-meat", 0, 0, 1)));
    addItem(b, "boar-meat", MEAT_STACK + 1);
    assert.deepEqual(b.items, [stack("boar-meat", 0, 0, 1)]);
  });
});

describe("moveItem", () => {
  test("moves a stack to empty cells", () => {
    const b = bag(4, 4, stack("boar-hide", 0, 0, 1));
    assert.deepEqual(moveItem(b, { x: 0, y: 0 }, { x: 2, y: 2 }, false)?.items, [stack("boar-hide", 2, 2)]);
  });

  test("can be picked up by any of its cells", () => {
    const b = bag(4, 4, stack("boar-hide", 0, 0));
    assert.deepEqual(moveItem(b, { x: 1, y: 1 }, { x: 2, y: 0 }, false)?.items, [stack("boar-hide", 2, 0)]);
  });

  test("can overlap where it was (shifting by one cell)", () => {
    const b = bag(4, 4, stack("boar-hide", 0, 0));
    assert.deepEqual(moveItem(b, { x: 0, y: 0 }, { x: 1, y: 0 }, false)?.items, [stack("boar-hide", 1, 0)]);
  });

  test("turns it in place", () => {
    const b = bag(4, 4, stack("boar-tusk", 0, 0));
    const turned = moveItem(b, { x: 0, y: 0 }, { x: 0, y: 0 }, true);
    assert.deepEqual(turned?.items, [stack("boar-tusk", 0, 0, 1, true)]);
  });

  test("refuses to drop it on another item, out of the bag, or nowhere new", () => {
    const b = bag(4, 4, stack("boar-hide", 0, 0), stack("boar-tusk", 3, 0));
    assert.equal(moveItem(b, { x: 0, y: 0 }, { x: 2, y: 0 }, false), null);
    assert.equal(moveItem(b, { x: 0, y: 0 }, { x: 3, y: 3 }, false), null);
    assert.equal(moveItem(b, { x: 0, y: 0 }, { x: 0, y: 0 }, false), null);
  });

  test("from an empty cell does nothing", () => {
    assert.equal(moveItem(bag(4, 4), { x: 1, y: 1 }, { x: 2, y: 2 }, false), null);
  });

  test("onto a stack of the same item, tops it up; what doesn't fit stays where it was", () => {
    const b = bag(4, 1, stack("boar-meat", 0, 0, 3), stack("boar-meat", 1, 0, MEAT_STACK - 1));
    assert.deepEqual(moveItem(b, { x: 0, y: 0 }, { x: 1, y: 0 }, false)?.items,
      [stack("boar-meat", 0, 0, 2), stack("boar-meat", 1, 0, MEAT_STACK)]);
  });

  test("a stack that all fits onto the other one is gone", () => {
    const b = bag(4, 1, stack("boar-meat", 0, 0, 1), stack("boar-meat", 1, 0, 1));
    assert.deepEqual(moveItem(b, { x: 0, y: 0 }, { x: 1, y: 0 }, false)?.items, [stack("boar-meat", 1, 0, 2)]);
  });

  test("onto a full stack, or a different item, is refused", () => {
    const b = bag(4, 1, stack("boar-meat", 0, 0, 1), stack("boar-meat", 1, 0, MEAT_STACK));
    assert.equal(moveItem(b, { x: 0, y: 0 }, { x: 1, y: 0 }, false), null);
    assert.equal(moveItem(bag(4, 2, stack("boar-meat", 0, 0), stack("boar-tusk", 1, 0)),
      { x: 0, y: 0 }, { x: 1, y: 1 }, false), null);
  });

  test("doesn't change its input", () => {
    const b = frozen(bag(4, 4, stack("boar-hide", 0, 0)));
    moveItem(b, { x: 0, y: 0 }, { x: 2, y: 2 }, false);
    assert.deepEqual(b.items, [stack("boar-hide", 0, 0)]);
  });
});

describe("takeAt", () => {
  test("takes one from the stack covering the cell", () => {
    const b = bag(2, 1, stack("boar-meat", 1, 0, 3));
    assert.deepEqual(takeAt(b, { x: 1, y: 0 })?.items, [stack("boar-meat", 1, 0, 2)]);
  });

  test("the last one leaves the cell empty", () => {
    assert.deepEqual(takeAt(bag(2, 1, stack("boar-meat", 1, 0, 1)), { x: 1, y: 0 })?.items, []);
  });

  test("takes as many as asked, at most the whole stack", () => {
    const b = bag(2, 1, stack("boar-meat", 1, 0, 3));
    assert.deepEqual(takeAt(b, { x: 1, y: 0 }, 2)?.items, [stack("boar-meat", 1, 0, 1)]);
    assert.deepEqual(takeAt(b, { x: 1, y: 0 }, 9)?.items, []);
  });

  test("an empty cell gives null", () => {
    assert.equal(takeAt(bag(2, 1), { x: 0, y: 0 }), null);
  });

  test("doesn't change its input", () => {
    const b = frozen(bag(2, 1, stack("boar-meat", 0, 0, 2)));
    takeAt(b, { x: 0, y: 0 });
    assert.equal(b.items[0]?.count, 2);
  });
});

describe("bagWeight", () => {
  test("adds up every item, each stack counted in full", () => {
    const b = bag(4, 4, stack("boar-meat", 0, 0, 3), stack("boar-hide", 1, 0), stack("boar-tusk", 3, 0));
    const expected = 3 * ITEMS["boar-meat"].weight + ITEMS["boar-hide"].weight + ITEMS["boar-tusk"].weight;
    assert.equal(bagWeight(b), expected);
  });

  test("an empty bag weighs nothing", () => {
    assert.equal(bagWeight(emptyBag()), 0);
  });
});

describe("bagCounts", () => {
  test("counts each item over all its stacks", () => {
    const b = bag(4, 4, stack("boar-meat", 0, 0, 3), stack("boar-meat", 0, 1, 2), stack("boar-tusk", 3, 0));
    assert.deepEqual(bagCounts(b), { "boar-meat": 5, "boar-tusk": 1 });
  });

  test("an empty bag holds nothing", () => {
    assert.deepEqual(bagCounts(emptyBag()), {});
  });
});

describe("a grid that holds one thing (a quiver's)", () => {
  const holds = { item: "arrow", stackSize: 3 * ITEMS.arrow.stackSize } as const;
  const quiver = (...items: BagItem[]): Bag => ({ cols: 1, rows: 1, items, holds });

  test("only that thing fits in it", () => {
    assert.equal(fits(quiver(), "arrow", { x: 0, y: 0 }, false), true);
    assert.equal(fits(quiver(), "boar-meat", { x: 0, y: 0 }, false), false);
    assert.deepEqual(addItem(frozen(quiver()), "boar-meat", 1), { bag: quiver(), left: 1 });
  });

  test("it stacks to the grid's own size, not the item's", () => {
    assert.equal(stackSizeIn(quiver(), "arrow"), holds.stackSize);
    assert.equal(stackSizeIn(emptyBag(), "arrow"), ITEMS.arrow.stackSize);
    assert.deepEqual(addItem(frozen(quiver()), "arrow", holds.stackSize + 1), {
      bag: quiver(stack("arrow", 0, 0, holds.stackSize)), left: 1,
    });
  });

  test("its stack is topped up to its own size, and a bigger one is a problem only outside it", () => {
    const full = holds.stackSize;
    assert.deepEqual(bagProblems(quiver(stack("arrow", 0, 0, full))), []);
    assert.equal(bagProblems(quiver(stack("arrow", 0, 0, full + 1))).length, 1);
    assert.equal(bagProblems(quiver(stack("boar-meat", 0, 0))).length, 1);
    assert.equal(bagProblems(bag(1, 1, stack("arrow", 0, 0, full))).length, 1);
  });
});

describe("bagProblems", () => {
  test("a good bag has none", () => {
    assert.deepEqual(bagProblems(bag(4, 4, stack("boar-hide", 0, 0), stack("boar-tusk", 2, 0, 1, true))), []);
  });

  test("finds overlaps, items out of the bag, bad counts and unknown items", () => {
    assert.equal(bagProblems(bag(4, 4, stack("boar-hide", 0, 0), stack("boar-meat", 1, 1))).length, 1);
    assert.equal(bagProblems(bag(4, 4, stack("boar-hide", 3, 0))).length, 1);
    assert.equal(bagProblems(bag(4, 4, stack("boar-meat", 0, 0, 0))).length, 1);
    assert.equal(bagProblems(bag(4, 4, stack("boar-meat", 0, 0, MEAT_STACK + 1))).length, 1);
    assert.equal(bagProblems(bag(4, 4, stack("axe" as ItemId, 0, 0))).length, 1);
  });

  test("no sequence of adds, moves and takes breaks a bag", () => {
    // A small seeded generator, so a failure can be replayed.
    let seed = 7;
    const rand = (n: number) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 16) % n; };
    const ids = Object.keys(ITEMS) as ItemId[];
    let b = emptyBag();
    for (let i = 0; i < 2000; i++) {
      const cell = () => ({ x: rand(b.cols + 1), y: rand(b.rows + 1) });
      const op = rand(3);
      if (op === 0) b = addItem(b, ids[rand(ids.length)] as ItemId, 1 + rand(7)).bag;
      else if (op === 1) b = moveItem(b, cell(), cell(), rand(2) === 1) ?? b;
      else b = takeAt(b, cell()) ?? b;
      assert.deepEqual(bagProblems(b), [], `after step ${i}`);
    }
    assert.ok(b.items.length > 0);
  });
});
