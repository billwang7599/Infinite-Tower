import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { SHOPS } from "../../../src/core/content/shops.js";
import { getRegion } from "../../../src/core/world/index.js";

const WOLF = ENEMIES["grey-wolf"].def;

describe("the grey wolf", () => {
  test("is quicker and frailer than the boar", () => {
    const boar = ENEMIES["wild-boar"].def;
    assert.ok(WOLF.maxHp < boar.maxHp / 2);
    assert.ok(WOLF.walkSpeed > boar.walkSpeed);
  });

  test("drops its essence always, and a pelt and a fang on a low roll", () => {
    assert.deepEqual(rollDrops("grey-wolf", () => 0.999, () => false), { "grey-wolf-essence": 1 });
    const loot = rollDrops("grey-wolf", () => 0, () => false);
    assert.ok((loot["wolf-pelt"] ?? 0) >= 1 && (loot["wolf-fang"] ?? 0) >= 1);
  });

  test("the forge buys its pelt and fang", () => {
    for (const item of ["wolf-pelt", "wolf-fang"] as const) assert.ok(SHOPS.smith.buys.includes(item), item);
  });

  test("roams the Grass Field and the Mistwood", () => {
    const count = (region: string, enemy: string) => getRegion(region).spawns.filter((s) => s.enemy === enemy).length;
    assert.ok(count("grass-field", "grey-wolf") >= 1);
    assert.ok(count("mistwood", "grey-wolf") >= 1);
  });
});
