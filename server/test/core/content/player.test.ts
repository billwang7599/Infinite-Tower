import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BASE_STATS, coreStats, emptyBag, emptyEquipment, maxHpOf, newCore, staminaMaxOf,
} from "@infinite-tower/shared";
import { fullVitals, newPlayer, PLAYER_STATS } from "../../../src/core/content/player.js";

describe("player content", () => {
  test("full vitals are the most HP and stamina the stats give", () => {
    assert.deepEqual(fullVitals(PLAYER_STATS), { hp: maxHpOf(PLAYER_STATS), stamina: staminaMaxOf(PLAYER_STATS) });
    assert.equal(fullVitals({ ...PLAYER_STATS, stamina: 7 }).stamina, staminaMaxOf({ ...PLAYER_STATS, stamina: 7 }));
  });

  test("a new player's stats are a new core's: every stat at its base", () => {
    assert.deepEqual(PLAYER_STATS, coreStats(newCore()));
    assert.deepEqual(PLAYER_STATS, BASE_STATS);
  });

  test("a new player is rested and at Early Yan, and starts with nothing: empty hands, an empty bag, no words", () => {
    assert.deepEqual(newPlayer(), {
      vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null, bag: emptyBag(), knownWords: [],
      equipment: emptyEquipment(), skillbook: [null, null, null, null], story: { quests: {}, flags: [] }, level: null,
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
});
