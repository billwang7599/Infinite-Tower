import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ITEMS, WEAPONS, type Vec3, type WeaponId } from "@infinite-tower/shared";
import { impactPose, JOLT_M, joltOf, type Impact } from "../../../src/visuals/battle/impact.js";
import { cutOf, WEAPON_LOOKS } from "../../../src/visuals/battle/weapons.js";

const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const AWAY = { x: 0, y: 0, z: 1 }, RIGHT = { x: 1, y: 0, z: 0 };

describe("hit-stop", () => {
  test("a heavier blade's hit holds the picture longer", () => {
    const ids = (Object.keys(WEAPONS) as WeaponId[]).sort((a, b) => ITEMS[a].weight - ITEMS[b].weight);
    for (let i = 1; i < ids.length; i++) {
      const lighter = ids[i - 1]!, heavier = ids[i]!;
      if (ITEMS[heavier].weight === ITEMS[lighter].weight) continue;
      assert.ok(WEAPON_LOOKS[heavier].hitStopMs > WEAPON_LOOKS[lighter].hitStopMs, `${heavier} over ${lighter}`);
    }
  });

  test("frozen for its stop, then pushed out and back along its push, then done", () => {
    const push = { x: 0.2, y: 0, z: 0 };
    const at = (ageMs: number): ReturnType<typeof impactPose> =>
      impactPose({ ageMs, stopMs: 60, push, pushMs: 100 } satisfies Impact);
    assert.equal(at(0).frozen, true);
    assert.equal(at(59).frozen, true);
    assert.deepEqual(at(30).offset, { x: 0, y: 0, z: 0 });
    assert.equal(at(60).frozen, false);
    assert.ok(Math.abs(at(110).offset.x - push.x) < 1e-9, "all the way out halfway through");
    assert.ok(at(85).offset.x > 0 && at(85).offset.x < push.x);
    assert.ok(at(160).offset.x < 1e-9, "back where it was");
    assert.equal(at(160).done, true);
    assert.equal(at(120).done, false);
  });
});

describe("the jolt of a hit", () => {
  test("goes away from the attacker and the way the cut went across the screen", () => {
    const lr = joltOf(cutOf("light", "left"), AWAY, RIGHT), rl = joltOf(cutOf("light", "right"), AWAY, RIGHT);
    const tb = joltOf(cutOf("light", "top"), AWAY, RIGHT);
    assert.ok(lr.x > 0 && lr.z > 0, `lr ${JSON.stringify(lr)}`);
    assert.ok(rl.x < 0 && rl.z > 0, `rl ${JSON.stringify(rl)}`);
    assert.ok(tb.y < 0 && Math.abs(tb.x) < 1e-9, `tb ${JSON.stringify(tb)}`);
    for (const v of [lr, rl, tb]) assert.ok(Math.abs(len(v) - JOLT_M) < 1e-9);
  });

  test("an attack gone by pushes straight away", () => {
    const v = joltOf(null, AWAY, RIGHT);
    assert.ok(Math.abs(v.z - JOLT_M) < 1e-9 && Math.abs(v.x) < 1e-9 && Math.abs(v.y) < 1e-9);
  });
});
