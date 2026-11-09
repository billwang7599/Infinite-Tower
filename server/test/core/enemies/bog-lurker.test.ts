import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PLAYER } from "@infinite-tower/shared";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { SHOPS } from "../../../src/core/content/shops.js";
import { getRegion } from "../../../src/core/world/index.js";

const LURKER = ENEMIES["bog-lurker"].def;
const SLAM = LURKER.attacks.slam!;

describe("the bog lurker", () => {
  test("is slower and tankier than the boar, and hits harder", () => {
    const boar = ENEMIES["wild-boar"].def;
    assert.ok(LURKER.maxHp > boar.maxHp && LURKER.poise > boar.poise);
    assert.ok(LURKER.walkSpeed < boar.walkSpeed / 2);
    assert.ok(SLAM.damage > boar.attacks.lunge!.damage * 2);
  });

  test("its slam costs a blocker more stamina than a dodge does", () => {
    assert.ok(SLAM.damage > PLAYER.dodge.cost);
  });

  test("drops its essence always, and scales and a pearl on a low roll", () => {
    assert.deepEqual(rollDrops("bog-lurker", () => 0.999, () => false), { "bog-lurker-essence": 1 });
    const low = rollDrops("bog-lurker", () => 0, () => false);
    assert.ok((low["lurker-scale"] ?? 0) >= 1);
    assert.equal(low["bog-pearl"], 1);
  });

  test("the forge buys its scales and pearls", () => {
    assert.ok(SHOPS.smith.buys.includes("lurker-scale"));
    assert.ok(SHOPS.smith.buys.includes("bog-pearl"));
  });

  test("lurks in the Mistwood", () => {
    assert.ok(getRegion("mistwood").spawns.some((s) => s.enemy === "bog-lurker"));
  });
});
