import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { emptyBag, PLAYER, starterEquipment } from "@infinite-tower/shared";
import { fullVitals, newPlayer, PLAYER_STATS } from "../../../src/core/content/player.js";

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
});
