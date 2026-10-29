import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bagCounts, emptyBag, PLAYER, SLOTS, starterEquipment, WORDS } from "@infinite-tower/shared";
import {
  fullVitals, newPlayer, PLAYER_STATS, STARTER_KIT, withStarterKit,
} from "../../../src/core/content/player.js";

describe("player content", () => {
  test("full vitals are max HP and the stats' stamina", () => {
    assert.deepEqual(fullVitals(PLAYER_STATS), { hp: PLAYER.maxHp, stamina: PLAYER_STATS.stamina });
    assert.equal(fullVitals({ ...PLAYER_STATS, stamina: 7 }).stamina, 7);
  });

  test("a new player is rested and armed, with no wins, settings, character, skill words, bag or written pages", () => {
    assert.deepEqual(newPlayer(), {
      vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null, bag: emptyBag(), knownWords: [],
      equipment: starterEquipment(), skillbook: [null, null, null, null],
    });
  });

  test("each new player is its own object", () => {
    const a = newPlayer(), b = newPlayer();
    a.vitals.hp = 1;
    a.bag.items.push({ item: "boar-meat", count: 1, x: 0, y: 0, turned: false });
    assert.equal(b.vitals.hp, PLAYER.maxHp);
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
