import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bagWeight, carryLimit, CLOTH, emptyBag, emptyCloth, gearBurden, gearWeight, heldIn, ITEMS, moveGear, NO_PILE, SLOTS,
  starterEquipment, type Bag, type BagItem, type Equipment, type Gear, type ItemId, type Stats,
} from "@infinite-tower/shared";

const stack = (item: ItemId, x: number, y: number, count = 1, turned = false): BagItem =>
  ({ item, count, x, y, turned });
const grid = (cols: number, rows: number, ...items: BagItem[]): Bag => ({ cols, rows, items });
const NOTHING: Equipment = { rightHand: null, leftHand: null, head: null, body: null, legs: null, boots: null };

/** Deep-frozen, so a function that changes its input throws. */
function frozen(g: Gear): Gear {
  for (const b of [g.bag, g.cloth, g.pile]) {
    b.items.forEach((s) => Object.freeze(s));
    Object.freeze(b.items);
    Object.freeze(b);
  }
  Object.freeze(g.equipment);
  return Object.freeze(g);
}

const gear = (over: Partial<Gear> = {}): Gear => frozen({
  bag: emptyBag(), cloth: grid(CLOTH.cols, CLOTH.rows), pile: NO_PILE, equipment: starterEquipment(), ...over,
});

describe("the starting gear", () => {
  test("the sword in the right hand, the skillbook in the left, nothing else worn", () => {
    assert.deepEqual(starterEquipment(), { ...NOTHING, rightHand: "sword", leftHand: "skillbook" });
  });

  test("an empty cloth is the cloth's size, and each piece of starting gear is its own object", () => {
    assert.deepEqual(emptyCloth(), { cols: CLOTH.cols, rows: CLOTH.rows, items: [] });
    assert.notEqual(starterEquipment(), starterEquipment());
  });

  test("the sword and the skillbook are held in a hand, and don't stack", () => {
    for (const id of ["sword", "skillbook"] as const) {
      assert.equal(ITEMS[id].wearable.on, "hand");
      assert.equal(ITEMS[id].stackSize, 1);
    }
  });
});

describe("heldIn", () => {
  test("the hand that holds it, or null", () => {
    assert.equal(heldIn(starterEquipment(), "sword"), "rightHand");
    assert.equal(heldIn({ ...NOTHING, leftHand: "sword" }, "sword"), "leftHand");
    assert.equal(heldIn({ ...NOTHING, rightHand: "skillbook" }, "sword"), null);
  });
});

describe("weight", () => {
  test("what's worn counts, what's on the cloth or an open pile doesn't", () => {
    const bag = grid(6, 4, stack("boar-tusk", 0, 0));
    const cloth = grid(4, 4, stack("boar-hide", 0, 0));
    const pile = grid(4, 2, stack("boar-tusk", 0, 0));
    const worn = ITEMS.sword.weight + ITEMS.skillbook.weight;
    assert.equal(gearWeight(gear({ bag, cloth, pile })), bagWeight(bag) + worn);
  });

  test("the burden weighs the bag and the equipment together", () => {
    const stats: Stats = { stamina: 100, skillpower: 10, agility: 10, strength: 10 };
    const worn = ITEMS.sword.weight + ITEMS.skillbook.weight;
    const tusks = Math.ceil((carryLimit(stats) - worn) / ITEMS["boar-tusk"].weight);
    const bag = grid(tusks, 2, ...Array.from({ length: tusks }, (_, x) => stack("boar-tusk", x, 0)));
    assert.equal(gearBurden(gear({ bag, equipment: NOTHING }), stats), "light");
    assert.equal(gearBurden(gear({ bag }), stats), "heavy");
  });
});

describe("moveGear", () => {
  const bag = (...items: BagItem[]) => grid(6, 4, ...items);
  const cloth = (...items: BagItem[]) => grid(CLOTH.cols, CLOTH.rows, ...items);

  test("within the bag, it's the bag's move", () => {
    const g = gear({ bag: bag(stack("boar-tusk", 0, 0)) });
    const moved = moveGear(g, { in: "bag", x: 0, y: 1 }, { in: "bag", x: 3, y: 1 }, true);
    assert.deepEqual(moved?.bag.items, [stack("boar-tusk", 3, 1, 1, true)]);
    assert.equal(moveGear(g, { in: "bag", x: 2, y: 2 }, { in: "bag", x: 3, y: 1 }, false), null);
  });

  test("from the bag onto the cloth and back, turned as asked", () => {
    const g = gear({ bag: bag(stack("boar-hide", 1, 1)) });
    const out = moveGear(g, { in: "bag", x: 2, y: 2 }, { in: "cloth", x: 2, y: 2 }, false)!;
    assert.deepEqual(out.bag.items, []);
    assert.deepEqual(out.cloth.items, [stack("boar-hide", 2, 2)]);
    const back = moveGear(out, { in: "cloth", x: 2, y: 2 }, { in: "bag", x: 4, y: 0 }, false)!;
    assert.deepEqual(back.bag.items, [stack("boar-hide", 4, 0)]);
    assert.deepEqual(back.cloth.items, []);
  });

  test("not where it doesn't fit, nor from an empty cell", () => {
    const g = gear({ bag: bag(stack("boar-tusk", 0, 0)), cloth: cloth(stack("boar-hide", 0, 0)) });
    assert.equal(moveGear(g, { in: "bag", x: 0, y: 0 }, { in: "cloth", x: 1, y: 1 }, false), null);
    assert.equal(moveGear(g, { in: "bag", x: 0, y: 0 }, { in: "cloth", x: 3, y: 3 }, false), null);
    assert.equal(moveGear(g, { in: "bag", x: 3, y: 3 }, { in: "cloth", x: 3, y: 0 }, false), null);
  });

  test("onto a stack of the same thing, it tops that up and the rest stays", () => {
    const max = ITEMS["boar-meat"].stackSize;
    const g = gear({ bag: bag(stack("boar-meat", 0, 0, max)), cloth: cloth(stack("boar-meat", 1, 1, max - 2)) });
    const moved = moveGear(g, { in: "bag", x: 0, y: 0 }, { in: "cloth", x: 1, y: 1 }, false)!;
    assert.deepEqual(moved.cloth.items, [stack("boar-meat", 1, 1, max)]);
    assert.deepEqual(moved.bag.items, [stack("boar-meat", 0, 0, max - 2)]);
  });

  test("taking the sword off into the bag, then putting it in the other hand", () => {
    const g = gear({ equipment: { ...NOTHING, rightHand: "sword" } });
    const off = moveGear(g, { in: "slot", slot: "rightHand" }, { in: "bag", x: 0, y: 1 }, true)!;
    assert.equal(off.equipment.rightHand, null);
    assert.deepEqual(off.bag.items, [stack("sword", 0, 1, 1, true)]);
    const on = moveGear(off, { in: "bag", x: 2, y: 1 }, { in: "slot", slot: "leftHand" }, false)!;
    assert.equal(on.equipment.leftHand, "sword");
    assert.deepEqual(on.bag.items, []);
  });

  test("a hand-to-hand move swaps what the hands hold", () => {
    const moved = moveGear(gear(), { in: "slot", slot: "rightHand" }, { in: "slot", slot: "leftHand" }, false)!;
    assert.deepEqual(moved.equipment, { ...NOTHING, rightHand: "skillbook", leftHand: "sword" });
    const one = gear({ equipment: { ...NOTHING, rightHand: "sword" } });
    const across = moveGear(one, { in: "slot", slot: "rightHand" }, { in: "slot", slot: "leftHand" }, false)!;
    assert.deepEqual(across.equipment, { ...NOTHING, leftHand: "sword" });
  });

  test("only into a slot that takes it, and only an empty one from a grid", () => {
    const g = gear({ bag: bag(stack("boar-tusk", 0, 0), stack("sword", 1, 0)), equipment: NOTHING });
    for (const slot of SLOTS) {
      assert.equal(moveGear(g, { in: "bag", x: 0, y: 0 }, { in: "slot", slot }, false), null, slot);
    }
    for (const slot of ["head", "body", "legs", "boots"] as const) {
      assert.equal(moveGear(g, { in: "bag", x: 1, y: 0 }, { in: "slot", slot }, false), null, slot);
    }
    const full = gear({ bag: bag(stack("sword", 1, 0)) });
    assert.equal(moveGear(full, { in: "bag", x: 1, y: 0 }, { in: "slot", slot: "rightHand" }, false), null);
    assert.equal(moveGear(full, { in: "slot", slot: "rightHand" }, { in: "slot", slot: "head" }, false), null);
  });

  test("nothing from an empty slot, nor onto where it is", () => {
    const g = gear({ equipment: NOTHING });
    assert.equal(moveGear(g, { in: "slot", slot: "rightHand" }, { in: "bag", x: 0, y: 0 }, false), null);
    assert.equal(moveGear(gear(), { in: "slot", slot: "rightHand" }, { in: "slot", slot: "rightHand" }, false), null);
  });

  test("off a hand only where it fits in the grid", () => {
    const g = gear({ bag: bag(stack("boar-hide", 0, 0)) });
    assert.equal(moveGear(g, { in: "slot", slot: "rightHand" }, { in: "bag", x: 1, y: 1 }, false), null);
    assert.equal(moveGear(g, { in: "slot", slot: "rightHand" }, { in: "bag", x: 5, y: 2 }, false), null);
  });
});

describe("moveGear with a pile open", () => {
  const pile = (...items: BagItem[]) => grid(4, 2, ...items);
  const PILE_TUSK = { in: "pile", x: 0, y: 0 } as const;

  test("its items are taken into the bag, turned as asked, and leave the pile", () => {
    const g = gear({ pile: pile(stack("boar-tusk", 0, 0), stack("boar-hide", 1, 0)) });
    const taken = moveGear(g, PILE_TUSK, { in: "bag", x: 2, y: 1 }, true)!;
    assert.deepEqual(taken.bag.items, [stack("boar-tusk", 2, 1, 1, true)]);
    assert.deepEqual(taken.pile.items, [stack("boar-hide", 1, 0)]);
  });

  test("onto a stack in the bag, only what fits there is taken", () => {
    const max = ITEMS["boar-meat"].stackSize;
    const g = gear({ bag: grid(6, 4, stack("boar-meat", 0, 0, max - 1)), pile: pile(stack("boar-meat", 2, 1, 3)) });
    const taken = moveGear(g, { in: "pile", x: 2, y: 1 }, { in: "bag", x: 0, y: 0 }, false)!;
    assert.deepEqual(taken.bag.items, [stack("boar-meat", 0, 0, max)]);
    assert.deepEqual(taken.pile.items, [stack("boar-meat", 2, 1, 2)]);
  });

  test("a weapon goes straight into an empty hand", () => {
    const g = gear({ equipment: NOTHING, pile: pile(stack("longsword", 3, 0)) });
    const taken = moveGear(g, { in: "pile", x: 3, y: 1 }, { in: "slot", slot: "rightHand" }, false)!;
    assert.equal(taken.equipment.rightHand, "longsword");
    assert.deepEqual(taken.pile.items, []);
  });

  test("nothing goes onto it: not from the bag, a hand or the cloth, nor moved about on it", () => {
    const g = gear({
      bag: grid(6, 4, stack("boar-hide", 0, 0)), cloth: grid(4, 4, stack("boar-meat", 0, 0)),
      pile: pile(stack("boar-tusk", 0, 0)),
    });
    const free = { in: "pile", x: 2, y: 0 } as const;
    assert.equal(moveGear(g, { in: "bag", x: 0, y: 0 }, free, false), null);
    assert.equal(moveGear(g, { in: "cloth", x: 0, y: 0 }, free, false), null);
    assert.equal(moveGear(g, { in: "slot", slot: "rightHand" }, free, false), null);
    assert.equal(moveGear(g, PILE_TUSK, { in: "pile", x: 3, y: 0 }, false), null);
    assert.equal(moveGear(g, PILE_TUSK, PILE_TUSK, true), null);
  });

  test("no pile open is a grid with no cells", () => {
    assert.deepEqual(NO_PILE, { cols: 0, rows: 0, items: [] });
    assert.equal(moveGear(gear(), { in: "slot", slot: "rightHand" }, { in: "pile", x: 0, y: 0 }, false), null);
  });
});
