import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { touchSystem } from "../../../src/core/overworld/behaviors/touch.js";
import { spawnActor } from "../../../src/core/overworld/parts.js";
import { testOverworld } from "../overworld/helpers.js";

describe("rollDrops", () => {
  test("a lowest roll drops boar meat, a hide and a tusk from a wild boar", () => {
    const loot = rollDrops("wild-boar", () => 0);
    for (const item of ["boar-meat", "boar-hide", "boar-tusk"] as const) assert.ok((loot[item] ?? 0) >= 1, item);
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

describe("ENEMIES", () => {
  test("each is listed under its own id", () => {
    for (const [id, enemy] of Object.entries(ENEMIES)) assert.equal(enemy.def.id, id);
  });

  test("each one's overworld actor starts its own fight when it touches you", () => {
    for (const [id, enemy] of Object.entries(ENEMIES)) {
      const f = testOverworld({ playerAt: { x: 0.5, z: 0 } });
      const e = spawnActor(f.world, enemy.def.id, { x: 0, z: 0 }, enemy.overworld());
      touchSystem(f.ctx)(f.world, 0.1);
      assert.deepEqual(f.encounters, [{ source: e, enemy: id }]);
    }
  });
});
