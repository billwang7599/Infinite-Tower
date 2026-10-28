import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { rollDrops } from "../../../src/core/content/drops.js";
import { ENEMIES } from "../../../src/core/content/enemies.js";

describe("rollDrops", () => {
  test("a lowest roll drops boar meat, a hide and a tusk from a wild boar", () => {
    const loot = rollDrops("wild-boar", () => 0);
    for (const item of ["boar-meat", "boar-hide", "boar-tusk"] as const) assert.ok((loot[item] ?? 0) >= 1, item);
  });

  test("the Kobold's own blade never drops, even on the lowest roll", () => {
    assert.equal(ENEMIES["kobold-swordsman"].wielder?.hands.rightHand, "kobold-blade");
    assert.deepEqual(rollDrops("kobold-swordsman", () => 0), {});
  });

  test("the Goblin Warlock drops nothing, even on the lowest roll", () => {
    assert.deepEqual(rollDrops("goblin-warlock", () => 0), {});
  });

  test("a highest roll drops nothing", () => {
    assert.deepEqual(rollDrops("wild-boar", () => 0.999), {});
  });

  test("returns fresh counts each time", () => {
    const a = rollDrops("wild-boar", () => 0);
    const b = rollDrops("wild-boar", () => 0);
    assert.notEqual(a, b);
    assert.deepEqual(a, b);
  });
});
