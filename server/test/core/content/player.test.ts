import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BASE_BAG, BASE_STATS, bagCounts, bagProblems, coreStats, emptyBag, emptyEquipment, ITEMS, maxHpOf, newCore, packFor,
  staminaMaxOf, stowedCounts, WEAPONS, type Bag, type BagItem, type ItemId,
} from "@infinite-tower/shared";
import {
  fullVitals, keptSave, newPlayer, PLAYER_STATS, STARTER_BACKPACK,
} from "../../../src/core/content/player.js";
import type { StoredSave } from "../../../src/core/ports.js";
import { START_REGION } from "../../../src/core/world/index.js";

describe("player content", () => {
  test("full vitals are the most HP and stamina the stats give", () => {
    assert.deepEqual(fullVitals(PLAYER_STATS), { hp: maxHpOf(PLAYER_STATS), stamina: staminaMaxOf(PLAYER_STATS) });
    assert.equal(fullVitals({ ...PLAYER_STATS, stamina: 7 }).stamina, staminaMaxOf({ ...PLAYER_STATS, stamina: 7 }));
  });

  test("a new player's stats are a new core's: every stat at its base", () => {
    assert.deepEqual(PLAYER_STATS, coreStats(newCore()));
    assert.deepEqual(PLAYER_STATS, BASE_STATS);
  });

  test("a new player is rested and at Early Yan, and starts with only a backpack on: empty hands and grids", () => {
    assert.deepEqual(newPlayer(), {
      vitals: fullVitals(PLAYER_STATS), settings: {}, character: null, bag: emptyBag(),
      pack: packFor(STARTER_BACKPACK), quiver: packFor(null), knownWords: [],
      equipment: { ...emptyEquipment(), back: STARTER_BACKPACK },
      skillbook: [null, null, null, null], story: { quests: {}, flags: [] }, pad: START_REGION, core: newCore(),
      shopsBought: [], faith: {},
    });
  });

  test("each new player is its own object", () => {
    const a = newPlayer(), b = newPlayer();
    a.vitals.hp = 1;
    a.bag.items.push({ item: "boar-meat", count: 1, x: 0, y: 0, turned: false });
    assert.equal(b.vitals.hp, maxHpOf(PLAYER_STATS));
    assert.deepEqual(b.bag, emptyBag());
  });
});

describe("loading a save", () => {
  const OLD_BAG = { cols: 6, rows: 4 };
  const stack = (item: ItemId, x: number, y: number, count = 1, turned = false): BagItem =>
    ({ item, count, x, y, turned });
  const stored = (bag: Bag, over: Partial<StoredSave> = {}): StoredSave =>
    ({ ...newPlayer(), bag, pack: packFor(null), quiver: packFor(null), equipment: emptyEquipment(), ...over });
  const cellsOf = (grid: { cols: number; rows: number }) => grid.cols * grid.rows;
  const sizeOf = (grid: { cols: number; rows: number }) => [grid.cols, grid.rows];

  test("one from before the backpack gets the starter backpack on, its old bag laid out again in both grids", () => {
    const items = [stack("greatsword", 0, 0), stack("boar-hide", 1, 0), stack("boar-meat", 3, 0, 4),
      stack("sword", 5, 0), stack("wolf-fang", 3, 1, 7), stack("boar-tusk", 4, 2)];
    const { save, spilled } = keptSave(stored({ ...OLD_BAG, items }));
    assert.equal(save.equipment.back, STARTER_BACKPACK);
    assert.deepEqual(sizeOf(save.bag), sizeOf(BASE_BAG));
    assert.deepEqual(sizeOf(save.pack), sizeOf(ITEMS[STARTER_BACKPACK].pack));
    assert.deepEqual(stowedCounts(save), bagCounts({ ...OLD_BAG, items }));
    assert.deepEqual([...bagProblems(save.bag), ...bagProblems(save.pack)], []);
    assert.deepEqual(spilled, {});
  });

  test("what fits in neither grid is spilled, for a pile at their feet", () => {
    const meat = ITEMS["boar-meat"].stackSize, cells = cellsOf(OLD_BAG);
    const full = Array.from({ length: cells }, (_, i) =>
      stack("boar-meat", i % OLD_BAG.cols, Math.floor(i / OLD_BAG.cols), meat));
    const { save, spilled } = keptSave(stored({ ...OLD_BAG, items: full }));
    const room = cellsOf(BASE_BAG) + cellsOf(ITEMS[STARTER_BACKPACK].pack);
    assert.deepEqual(stowedCounts(save), { "boar-meat": room * meat });
    assert.deepEqual(spilled, { "boar-meat": (cells - room) * meat });
  });

  test("a weapon held under its minimum strength at its grip is put in the bag, or spilled", () => {
    const equipment = { ...emptyEquipment(), rightHand: "greatsword", leftHand: "skillbook" } as const;
    assert.ok(PLAYER_STATS.strength < WEAPONS.greatsword.minStrength);
    const packed = { equipment: { ...equipment, back: STARTER_BACKPACK }, pack: packFor(STARTER_BACKPACK) };
    const roomy = keptSave(stored(emptyBag(), packed));
    assert.equal(roomy.save.equipment.rightHand, null);
    assert.equal(roomy.save.equipment.leftHand, "skillbook");
    assert.deepEqual(stowedCounts(roomy.save), { greatsword: 1 });
    assert.deepEqual(roomy.spilled, {});
    const meat = ITEMS["boar-meat"].stackSize, full = Array.from({ length: cellsOf(BASE_BAG) }, (_, i) =>
      stack("boar-meat", i % BASE_BAG.cols, Math.floor(i / BASE_BAG.cols), meat));
    const cramped = keptSave(stored({ ...emptyBag(), items: full }, { equipment }));
    assert.equal(cramped.save.equipment.rightHand, null);
    assert.deepEqual(cramped.spilled, { greatsword: 1 });
    const alone = keptSave(stored(emptyBag(), { equipment: { ...equipment, leftHand: null } }));
    assert.equal(alone.save.equipment.rightHand, "greatsword", "alone it takes both hands, enough for it");
  });

  test("a backpack already on stays, and none is given to a save with the base bag", () => {
    const bag = { ...emptyBag(), items: [stack("boar-meat", 2, 1, 3)] };
    const bare = keptSave(stored(bag));
    assert.deepEqual(bare.save.bag, bag);
    assert.equal(bare.save.equipment.back, null);
    assert.deepEqual(bare.save.pack, packFor(null));
    const pack = { ...packFor(STARTER_BACKPACK), items: [stack("boar-tusk", 3, 2)] };
    const worn = keptSave(stored(bag, { pack, equipment: { ...emptyEquipment(), back: STARTER_BACKPACK } }));
    assert.deepEqual([worn.save.bag, worn.save.pack], [bag, pack]);
  });

  test("a backpack's grid of another size than its backpack's is laid out again at its size", () => {
    const pack = { cols: 5, rows: 1, items: [stack("boar-tusk", 0, 0, 1, true), stack("greatsword", 1, 0, 1, true)] };
    const { save } = keptSave(stored(emptyBag(), { pack, equipment: { ...emptyEquipment(), back: STARTER_BACKPACK } }));
    assert.deepEqual(sizeOf(save.pack), sizeOf(ITEMS[STARTER_BACKPACK].pack));
    assert.deepEqual(stowedCounts(save), { "boar-tusk": 1, greatsword: 1 });
    assert.deepEqual([...bagProblems(save.bag), ...bagProblems(save.pack)], []);
  });

  const QUIVER = "training-quiver" satisfies ItemId;
  const quivered = (arrows: number): Bag => ({ ...packFor(QUIVER), items: [stack("arrow", 0, 0, arrows)] });

  test("a worn quiver keeps its arrows", () => {
    const quiver = quivered(ITEMS[QUIVER].pack.holds.stackSize);
    const { save } = keptSave(stored(emptyBag(), { quiver, equipment: { ...emptyEquipment(), hip: QUIVER } }));
    assert.deepEqual(save.quiver, quiver);
  });

  test("a quiver's grid unlike its quiver's now is laid out again, what doesn't fit going into the bag", () => {
    const old = { cols: 1, rows: 1, items: [stack("arrow", 0, 0, 100)] };
    const { save } = keptSave(stored(emptyBag(), { quiver: old, equipment: { ...emptyEquipment(), hip: QUIVER } }));
    assert.deepEqual(save.quiver, quivered(ITEMS[QUIVER].pack.holds.stackSize));
    assert.equal(stowedCounts(save).arrow, 100);
    assert.deepEqual([...bagProblems(save.bag), ...bagProblems(save.quiver)], []);
  });

  test("one from before bows took both hands: what the left hand held beside a bow goes into the bag", () => {
    const equipment = { ...emptyEquipment(), rightHand: "training-bow", leftHand: "skillbook" } as const;
    const { save } = keptSave(stored(emptyBag(), { equipment }));
    assert.deepEqual([save.equipment.rightHand, save.equipment.leftHand], ["training-bow", null]);
    assert.equal(stowedCounts(save).skillbook, 1);
  });
});
