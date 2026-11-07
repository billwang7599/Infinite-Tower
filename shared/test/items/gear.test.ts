import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AVERAGE_STAT, BASE_BAG, bagWeight, BASE_STATS, carriedCounts, carryLimit, CLOTH, displacedBy, emptyBag, emptyCloth,
  emptyEquipment, fitsSlot, gearBurden, gearWeight, heldIn, ITEM_IDS, itemDef, ITEMS, moveGear as moveGearWith, NO_PILE,
  packFor, SLOTS, stow, stowedCounts, twoHanded, unstow, WEAPONS, type Bag, type BagItem, type Equipment, type Gear,
  type ItemId, type Slot, type Spot,
} from "@infinite-tower/shared";
import { armed } from "../battle/fight/fixtures.js";

const stack = (item: ItemId, x: number, y: number, count = 1, turned = false): BagItem =>
  ({ item, count, x, y, turned });
const grid = (cols: number, rows: number, ...items: BagItem[]): Bag => ({ cols, rows, items });
const moveGear = (g: Gear, from: Spot, to: Spot, turned: boolean) => moveGearWith(g, from, to, turned, AVERAGE_STAT);
const NOTHING: Equipment = emptyEquipment();

/** Deep-frozen, so a function that changes its input throws. */
function frozen(g: Gear): Gear {
  for (const b of [g.bag, g.pack, g.quiver, g.cloth, g.pile]) {
    b.items.forEach((s) => Object.freeze(s));
    Object.freeze(b.items);
    Object.freeze(b);
  }
  Object.freeze(g.equipment);
  return Object.freeze(g);
}

const gear = (over: Partial<Gear> = {}): Gear => frozen({
  bag: emptyBag(), pack: packFor(null), quiver: packFor(null), cloth: grid(CLOTH.cols, CLOTH.rows), pile: NO_PILE,
  equipment: armed(),
  ...over,
});

describe("the starting gear", () => {
  test("the sword in the right hand, the skillbook in the left, nothing else worn", () => {
    assert.deepEqual(armed(), { ...NOTHING, rightHand: "sword", leftHand: "skillbook" });
  });

  test("an empty cloth is the cloth's size, and each piece of starting gear is its own object", () => {
    assert.deepEqual(emptyCloth(), { cols: CLOTH.cols, rows: CLOTH.rows, items: [] });
    assert.notEqual(armed(), armed());
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
    assert.equal(heldIn(armed(), "sword"), "rightHand");
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
    const stats = BASE_STATS;
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
    assert.equal(moveGear(g, { in: "bag", x: 0, y: 0 }, { in: "cloth", x: CLOTH.cols - 1, y: CLOTH.rows - 1 }, false), null);
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

  test("a weapon goes into a hand only with its minimum strength", () => {
    const need = WEAPONS.greatsword.minStrength;
    const g = gear({ bag: grid(6, 4, stack("greatsword", 0, 0)), equipment: NOTHING });
    const equip = (strength: number) =>
      moveGearWith(g, { in: "bag", x: 0, y: 0 }, { in: "slot", slot: "rightHand" }, false, strength);
    assert.equal(equip(need - 1), null);
    assert.equal(equip(need)?.equipment.rightHand, "greatsword");
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
    const taken = moveGear(g, PILE_TUSK, { in: "bag", x: 1, y: 1 }, true)!;
    assert.deepEqual(taken.bag.items, [stack("boar-tusk", 1, 1, 1, true)]);
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

const BACKPACK = "canvas-backpack" satisfies ItemId;
const BACK = { in: "slot", slot: "back" } as const;

describe("the bag and the backpack", () => {
  const packed = (...items: BagItem[]): Bag => ({ ...packFor(BACKPACK), items });
  const wearing = (over: Partial<Gear> = {}) =>
    gear({ equipment: { ...armed(), back: BACKPACK }, pack: packed(), ...over });

  test("the base bag is very small, and a backpack's grid is its own size, from the item", () => {
    assert.deepEqual(emptyBag(), { ...BASE_BAG, items: [] });
    assert.ok(BASE_BAG.cols * BASE_BAG.rows < ITEMS[BACKPACK].pack.cols * ITEMS[BACKPACK].pack.rows);
    assert.deepEqual(packFor(BACKPACK), { ...ITEMS[BACKPACK].pack, items: [] });
    assert.deepEqual(packFor(null), { cols: 0, rows: 0, items: [] });
  });

  test("put on, a backpack brings its own empty grid; the bag stays apart and as it was", () => {
    const meat = stack("boar-meat", 2, 0);
    const g = gear({ bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack(BACKPACK, 0, 0), meat) });
    const on = moveGear(g, { in: "bag", x: 1, y: 1 }, BACK, false)!;
    assert.equal(on.equipment.back, BACKPACK);
    assert.deepEqual(on.pack, packFor(BACKPACK));
    assert.deepEqual(on.bag.items, [meat]);
  });

  test("things go from one grid to the other, and lie wholly in one", () => {
    const g = wearing({ bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack("boar-tusk", 0, 0)) });
    const over = moveGear(g, { in: "bag", x: 0, y: 1 }, { in: "pack", x: 3, y: 2 }, false)!;
    assert.deepEqual(over.bag.items, []);
    assert.deepEqual(over.pack.items, [stack("boar-tusk", 3, 2)]);
    const back = moveGear(over, { in: "pack", x: 3, y: 3 }, { in: "bag", x: 2, y: 0 }, false)!;
    assert.deepEqual(back.bag.items, [stack("boar-tusk", 2, 0)]);
    assert.deepEqual(back.pack.items, []);
    const greatsword = wearing({ pack: packed(stack("greatsword", 0, 0)) });
    for (const turned of [false, true]) {
      assert.equal(moveGear(greatsword, { in: "pack", x: 0, y: 0 }, { in: "bag", x: 0, y: 0 }, turned), null);
    }
  });

  test("with no backpack on there's nowhere in the second grid to put anything", () => {
    const g = gear({ bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack("boar-meat", 0, 0)) });
    assert.equal(moveGear(g, { in: "bag", x: 0, y: 0 }, { in: "pack", x: 0, y: 0 }, false), null);
  });

  test("it comes off only empty, never into its own grid, and its grid goes with it", () => {
    const full = wearing({ pack: packed(stack("boar-meat", 0, 0)) });
    assert.equal(moveGear(full, BACK, { in: "bag", x: 0, y: 0 }, false), null);
    const empty = wearing();
    assert.equal(moveGear(empty, BACK, { in: "pack", x: 0, y: 0 }, false), null);
    const off = moveGear(empty, BACK, { in: "bag", x: 0, y: 0 }, false)!;
    assert.equal(off.equipment.back, null);
    assert.deepEqual(off.bag.items, [stack(BACKPACK, 0, 0)]);
    assert.deepEqual(off.pack, packFor(null));
  });

  test("a second backpack goes on only once the first is off", () => {
    const g = wearing({ bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack(BACKPACK, 0, 0)) });
    assert.equal(moveGear(g, { in: "bag", x: 0, y: 0 }, BACK, false), null);
  });

  test("worn, it takes no bag space, but it and what's in it weigh", () => {
    const bag = grid(BASE_BAG.cols, BASE_BAG.rows, stack("boar-tusk", 0, 0));
    const pack = packed(stack("boar-hide", 0, 0), stack("boar-meat", 3, 3, 2));
    const g = wearing({ bag, pack, equipment: { ...NOTHING, back: BACKPACK } });
    assert.equal(gearWeight(g), bagWeight(bag) + bagWeight(pack) + ITEMS[BACKPACK].weight);
  });

  test("what's carried counts both grids and every slot", () => {
    const g = wearing({
      bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack("boar-meat", 0, 0, 2)),
      pack: packed(stack("boar-meat", 0, 0, 3), stack("boar-tusk", 1, 0)),
      equipment: { ...armed(), back: BACKPACK, ring3: "copper-ring", belt: "leather-belt" },
    });
    assert.deepEqual(carriedCounts(g), {
      "boar-meat": 5, "boar-tusk": 1, sword: 1, skillbook: 1, [BACKPACK]: 1, "copper-ring": 1, "leather-belt": 1,
    });
  });

  test("stowing fills the bag first, then the backpack, and says how many fit in neither", () => {
    const cells = BASE_BAG.cols * BASE_BAG.rows + ITEMS[BACKPACK].pack.cols * ITEMS[BACKPACK].pack.rows;
    const { gear: stowed, left } = stow(wearing(), "boar-hide", cells);
    const hides = (b: Bag) => b.items.filter((s) => s.item === "boar-hide").length;
    assert.equal(hides(stowed.bag), 1);
    assert.equal(hides(stowed.pack), 4);
    assert.equal(left, cells - 5);
    assert.equal(stow(gear(), "boar-hide", 2).left, 1);
  });

  test("unstowing takes from the bag first, then the backpack; nothing if there aren't enough", () => {
    const max = ITEMS["boar-meat"].stackSize;
    const g = wearing({
      bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack("boar-meat", 0, 0, 2)), pack: packed(stack("boar-meat", 1, 1, max)),
    });
    const taken = unstow(g, "boar-meat", 3)!;
    assert.deepEqual(taken.bag.items, []);
    assert.deepEqual(taken.pack.items, [stack("boar-meat", 1, 1, max - 1)]);
    assert.equal(unstow(g, "boar-meat", max + 3), null);
  });
});

const QUIVER = "training-quiver" satisfies ItemId;
const QUIVER_SLOT = { in: "slot", slot: "hip" } as const;
const IN_QUIVER = { in: "quiver", x: 0, y: 0 } as const;

describe("the quiver", () => {
  const { holds } = ITEMS[QUIVER].pack;
  const quivered = (arrows = 0): Bag => ({ ...packFor(QUIVER), items: arrows ? [stack("arrow", 0, 0, arrows)] : [] });
  const wearing = (over: Partial<Gear> = {}) =>
    gear({ equipment: { ...NOTHING, hip: QUIVER }, quiver: quivered(), ...over });

  test("it brings one cell that holds only arrows, many more than a bag's cell", () => {
    assert.deepEqual(packFor(QUIVER), { ...ITEMS[QUIVER].pack, items: [] });
    assert.equal(ITEMS[QUIVER].pack.cols * ITEMS[QUIVER].pack.rows, 1);
    assert.equal(holds.item, "arrow");
    assert.ok(holds.stackSize > ITEMS.arrow.stackSize);
  });

  test("it's worn at the hip, with its grid; it comes off only empty, never into its own grid", () => {
    assert.deepEqual(SLOTS.filter((slot) => fitsSlot(QUIVER, slot)), ["hip"]);
    const on = moveGear(gear({ bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack(QUIVER, 0, 0)) }),
      { in: "bag", x: 0, y: 1 }, QUIVER_SLOT, false)!;
    assert.equal(on.equipment.hip, QUIVER);
    assert.deepEqual(on.quiver, packFor(QUIVER));
    assert.equal(moveGear(wearing({ quiver: quivered(1) }), QUIVER_SLOT, { in: "bag", x: 0, y: 0 }, false), null);
    assert.equal(moveGear(wearing(), QUIVER_SLOT, IN_QUIVER, false), null);
    const off = moveGear(wearing(), QUIVER_SLOT, { in: "bag", x: 0, y: 0 }, false)!;
    assert.equal(off.equipment.hip, null);
    assert.deepEqual(off.quiver, packFor(null));
  });

  test("arrows go in from the bag, topping it up to its own size; nothing else goes in", () => {
    const g = wearing({
      bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack("arrow", 0, 0, ITEMS.arrow.stackSize), stack("boar-meat", 1, 0)),
      quiver: quivered(holds.stackSize - 5),
    });
    const topped = moveGear(g, { in: "bag", x: 0, y: 0 }, IN_QUIVER, false)!;
    assert.deepEqual(topped.quiver.items, [stack("arrow", 0, 0, holds.stackSize)]);
    assert.deepEqual(topped.bag.items[0], stack("arrow", 0, 0, ITEMS.arrow.stackSize - 5));
    const into = moveGear(wearing({ bag: g.bag }), { in: "bag", x: 0, y: 0 }, IN_QUIVER, false)!;
    assert.deepEqual(into.quiver.items, [stack("arrow", 0, 0, ITEMS.arrow.stackSize)]);
    assert.equal(moveGear(wearing({ bag: g.bag }), { in: "bag", x: 1, y: 0 }, IN_QUIVER, false), null);
  });

  test("arrows stowed go into the quiver first, the rest into the bag; other things never into the quiver", () => {
    const { gear: stowed, left } = stow(wearing(), "arrow", holds.stackSize + 3);
    assert.equal(left, 0);
    assert.deepEqual(stowed.quiver.items, [stack("arrow", 0, 0, holds.stackSize)]);
    assert.deepEqual(stowed.bag.items, [stack("arrow", 0, 0, 3)]);
    assert.deepEqual(stow(wearing(), "boar-meat", 1).gear.quiver.items, []);
  });

  test("arrows are taken from the quiver first, then the bag", () => {
    const g = wearing({ bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack("arrow", 0, 0, 10)), quiver: quivered(2) });
    const taken = unstow(g, "arrow", 3)!;
    assert.deepEqual(taken.quiver.items, []);
    assert.deepEqual(taken.bag.items, [stack("arrow", 0, 0, 9)]);
    assert.equal(unstow(g, "arrow", 13), null);
  });

  test("what's in it counts toward what's carried and weighs", () => {
    const g = wearing({ quiver: quivered(30) });
    assert.equal(stowedCounts(g).arrow, 30);
    assert.deepEqual(carriedCounts(g), { arrow: 30, [QUIVER]: 1 });
    assert.equal(gearWeight(g), 30 * ITEMS.arrow.weight + ITEMS[QUIVER].weight);
  });
});

describe("a bow takes both hands", () => {
  const BOW_ITEM = "training-bow" satisfies ItemId;
  const RIGHT = { in: "slot", slot: "rightHand" } as const, LEFT = { in: "slot", slot: "leftHand" } as const;

  test("a bow is two-handed, a sword or the skillbook isn't; either way, the other hand has to let go", () => {
    assert.equal(twoHanded(BOW_ITEM), true);
    assert.equal(twoHanded("sword"), false);
    assert.equal(twoHanded("skillbook"), false);
    assert.equal(twoHanded(null), false);
    assert.equal(displacedBy(armed(), "sword", "rightHand"), null);
    assert.equal(displacedBy(armed(), BOW_ITEM, "rightHand"), "skillbook");
    assert.equal(displacedBy({ ...NOTHING, rightHand: BOW_ITEM }, "sword", "leftHand"), BOW_ITEM);
    assert.equal(displacedBy({ ...NOTHING, leftHand: BOW_ITEM }, BOW_ITEM, "leftHand"), null);
  });

  test("put in a hand, it sends what the other hand holds into the bag", () => {
    const g = gear({
      bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack(BOW_ITEM, 0, 0, 1, true)),
      equipment: { ...NOTHING, leftHand: "skillbook" },
    });
    const on = moveGear(g, { in: "bag", x: 0, y: 0 }, RIGHT, false)!;
    assert.deepEqual(on.equipment, { ...NOTHING, rightHand: BOW_ITEM });
    assert.deepEqual(on.bag.items, [stack("skillbook", 0, 0)]);
  });

  test("with no room in the bag or the backpack for the other hand's, it doesn't go on", () => {
    const meat = [0, 1, 2].map((x) => stack("boar-meat", x, 1));
    const g = gear({
      bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack(BOW_ITEM, 0, 0, 1, true), ...meat),
      equipment: { ...NOTHING, leftHand: "skillbook" },
    });
    assert.equal(moveGear(g, { in: "bag", x: 0, y: 0 }, RIGHT, false), null);
  });

  test("anything put in the other hand while it's held sends the bow into the bag", () => {
    const g = gear({
      bag: grid(BASE_BAG.cols, BASE_BAG.rows, stack("sword", 0, 0, 1, true)),
      equipment: { ...NOTHING, rightHand: BOW_ITEM },
    });
    const swapped = moveGear(g, { in: "bag", x: 0, y: 0 }, LEFT, false)!;
    assert.deepEqual(swapped.equipment, { ...NOTHING, leftHand: "sword" });
    assert.deepEqual(swapped.bag.items, [stack(BOW_ITEM, 0, 0, 1, true)]);
  });

  test("moved from one hand to the other, it goes alone", () => {
    const g = gear({ equipment: { ...NOTHING, rightHand: BOW_ITEM } });
    assert.deepEqual(moveGear(g, RIGHT, LEFT, false)!.equipment, { ...NOTHING, leftHand: BOW_ITEM });
  });
});

describe("the slots", () => {
  const slotsFor = (item: ItemId): Slot[] => SLOTS.filter((slot) => fitsSlot(item, slot));

  test("five rings, one a finger; a bracelet a wrist; a cap, a belt and a backpack each their own", () => {
    assert.deepEqual(slotsFor("copper-ring"), ["ring1", "ring2", "ring3", "ring4", "ring5"]);
    assert.deepEqual(slotsFor("braided-bracelet"), ["leftWrist", "rightWrist"]);
    assert.deepEqual(slotsFor("wool-cap"), ["cap"]);
    assert.deepEqual(slotsFor("leather-belt"), ["belt"]);
    assert.deepEqual(slotsFor(BACKPACK), ["back"]);
  });

  test("a cosmetic goes only in the cosmetic slot over its piece, and nothing else does", () => {
    assert.deepEqual(slotsFor("feathered-hat"), ["capCosmetic"]);
    for (const slot of ["capCosmetic", "headCosmetic", "bodyCosmetic", "legsCosmetic", "bootsCosmetic"] as const) {
      const takes = ITEM_IDS.filter((id) => fitsSlot(id, slot));
      assert.ok(takes.length > 0 || slot !== "capCosmetic", slot);
      assert.ok(takes.every((id) => itemDef(id).wearable?.cosmetic), slot);
    }
  });

  test("a ring moves finger to finger, swapping with one there", () => {
    const g = gear({ equipment: { ...NOTHING, ring1: "copper-ring" } });
    const moved = moveGear(g, { in: "slot", slot: "ring1" }, { in: "slot", slot: "ring5" }, false)!;
    assert.deepEqual(moved.equipment, { ...NOTHING, ring5: "copper-ring" });
    const onto = moveGear(g, { in: "slot", slot: "ring1" }, { in: "slot", slot: "leftWrist" }, false);
    assert.equal(onto, null);
  });

  test("every slot starts empty", () => {
    assert.deepEqual(Object.keys(emptyEquipment()), [...SLOTS]);
    assert.ok(SLOTS.every((slot) => emptyEquipment()[slot] === null));
  });
});
