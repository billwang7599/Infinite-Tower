import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bagCounts, BASE_STATS, coreStats, emptyBag, maxHpOf, newCore, SLOTS, staminaMaxOf, starterEquipment, WORDS,
} from "@infinite-tower/shared";
import {
  fullVitals, newPlayer, PLAYER_STATS, STARTER_KIT, withStarterKit,
} from "../../../src/core/content/player.js";

describe("player content", () => {
  test("full vitals are the most HP and stamina the stats give", () => {
    assert.deepEqual(fullVitals(PLAYER_STATS), { hp: maxHpOf(PLAYER_STATS), stamina: staminaMaxOf(PLAYER_STATS) });
    assert.equal(fullVitals({ ...PLAYER_STATS, stamina: 7 }).stamina, staminaMaxOf({ ...PLAYER_STATS, stamina: 7 }));
  });

  test("a new player's stats are a new core's: every stat at its base", () => {
    assert.deepEqual(PLAYER_STATS, coreStats(newCore()));
    assert.deepEqual(PLAYER_STATS, BASE_STATS);
  });

  test("a new player is rested, armed and at Early Yan, with nothing else yet", () => {
    assert.deepEqual(newPlayer(), {
      vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null, bag: emptyBag(), knownWords: [],
      equipment: starterEquipment(), skillbook: [null, null, null, null], story: { quests: {}, flags: [] }, level: null,
      core: newCore(), shopsBought: [],
    });
  });

  test("each new player is its own object", () => {
    const a = newPlayer(), b = newPlayer();
    a.vitals.hp = 1;
    a.bag.items.push({ item: "boar-meat", count: 1, x: 0, y: 0, turned: false });
    assert.equal(b.vitals.hp, maxHpOf(PLAYER_STATS));
    assert.deepEqual(b.bag, emptyBag());
  });

  test("withStarterKit teaches every word and packs each kit item the player doesn't carry yet", () => {
    const start = { ...newPlayer(), knownWords: ["nova" as const] };
    start.bag.items.push({ item: "boar-meat", count: 3, x: 5, y: 3, turned: false });
    const given = withStarterKit(start);
    assert.deepEqual(given.knownWords, [...WORDS]);
    assert.deepEqual(bagCounts(given.bag), { "boar-meat": 3, longsword: 1, greatsword: 1 }, "sword and book in hand");
    assert.deepEqual(given.equipment, start.equipment);
    assert.deepEqual(withStarterKit(given), given, "a second time adds nothing");
  });

  test("a new player gets every kit item, in hand or in the bag", () => {
    const kitted = withStarterKit(newPlayer());
    const carried = [...kitted.bag.items.map((s) => s.item), ...SLOTS.map((slot) => kitted.equipment[slot])];
    for (const item of STARTER_KIT) assert.ok(carried.includes(item), `${item} is carried`);
  });

  test("kit items already carried stay where they are", () => {
    const start = { ...newPlayer(), equipment: { ...starterEquipment(), rightHand: null } };
    start.bag.items.push({ item: "sword", count: 1, x: 5, y: 1, turned: false });
    const given = withStarterKit(start);
    assert.deepEqual(given.equipment, start.equipment);
    assert.deepEqual(given.bag.items.filter((s) => s.item === "sword"), [start.bag.items[0]]);
  });
});
