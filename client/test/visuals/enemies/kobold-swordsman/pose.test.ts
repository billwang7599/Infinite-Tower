import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SCREEN_DIR, SWING_DIRS, WAYS, type EnemyState, type Vec3 } from "@infinite-tower/shared";
import { KOBOLD_DRAWBACK, koboldPose } from "../../../../src/visuals/enemies/kobold-swordsman/pose.js";
import {
  DRAWBACK, MOTIONS, wayCut, type BladePose, type Cut,
} from "../../../../src/visuals/battle/weapons.js";

const D = Math.SQRT1_2;
const LR: Cut = { x: 1, y: 0 }, RL: Cut = { x: -1, y: 0 }, TB: Cut = { x: 0, y: -1 };
const TLBR: Cut = { x: D, y: -D }, TRBL: Cut = { x: -D, y: -D };
const CUTS = [LR, RL, TB, TLBR, TRBL];
const TOP_GUARD = MOTIONS.sword.held(TB);

const poseOf = (
  state: EnemyState, t: number, k: number, cut: Cut, stroke: { set: number; turn: number } | null = {
    set: k, turn: 0,
  }, held: BladePose = TOP_GUARD, heavy = false,
) => koboldPose(state, t, k, cut, MOTIONS.sword, stroke, held, heavy);

describe("the kobold's pose", () => {
  test("an attack's wind-up turns the blade to where its cut starts", () => {
    assert.ok(poseOf("weapon", 1, 1, LR).blade.x > 0.5);
  });

  test("from the drive on the blade is exactly where its stroke is: straight ahead halfway", () => {
    const mid = poseOf("weapon", 0.06, 0.5, LR, { set: 1, turn: 0.5 });
    assert.equal(mid.bladeExact, true);
    assert.ok(mid.blade.z > 0.9);
    assert.equal(poseOf("weapon", 0.1, 0.2, LR, { set: 1, turn: 0.1 }).bladeExact, true, "driven");
    assert.equal(poseOf("weapon", 0.1, 0.2, LR, { set: 0.5, turn: 0 }).bladeExact, false, "drawn back");
  });

  test("it follows through as it starts to recover, then eases to its recovery", () => {
    const following = poseOf("weaponRecover", 0.1, 0.1, LR, { set: 1, turn: 0.9 });
    assert.equal(following.bladeExact, true);
    assert.ok(following.blade.x < -0.5, "on the cut's far side");
    assert.equal(poseOf("weaponRecover", 0.5, 0.5, LR, null).bladeExact, false);
  });

  test("on guard, and holding its tell, its blade is where its guard holds it", () => {
    const left = MOTIONS.sword.held(RL);
    for (const state of ["approach", "weaponWindup"] as const) {
      assert.deepEqual(poseOf(state, 0.5, 0.5, RL, null, left).blade, left.blade, state);
    }
  });

  test("the sword hand goes with the blade: out to the side wound up, ahead mid-cut", () => {
    const guard = poseOf("approach", 0, 0, LR, null), wound = poseOf("weapon", 1, 1, LR);
    const mid = poseOf("weapon", 0.06, 0.5, LR, { set: 1, turn: 0.5 });
    assert.ok(wound.hand.x > guard.hand.x);
    assert.ok(mid.hand.z > wound.hand.z);
  });

  test("the body leads the blade: coiled wound up, already turned the cut's way mid-cut, carried past it", () => {
    const wound = poseOf("weapon", 1, 1, LR);
    const mid = poseOf("weapon", 0.06, 0.5, LR, { set: 1, turn: 0.5 });
    const past = poseOf("weaponRecover", 0.1, 0.1, LR, { set: 1, turn: 1.1 });
    assert.ok(wound.twist > 0 && wound.hipTwist > 0);
    assert.ok(Math.abs(mid.blade.x) < 0.2, "the blade is only straight ahead");
    assert.ok(mid.twist < 0 && mid.hipTwist < 0, "the body is already turned past it");
    assert.ok(past.twist < mid.twist);
  });

  test("a wind-up draws the blade back past its plain path, wider and behind, from any guard", () => {
    for (const cut of CUTS) {
      const own = MOTIONS.sword.held(cut);
      for (const [name, held] of [["its own side", own], ["the top", TOP_GUARD]] as const) {
        const fromGuard = (v: Vec3): number =>
          Math.acos(Math.min(1, v.x * held.blade.x + v.y * held.blade.y + v.z * held.blade.z));
        const set = 0.9, plain = MOTIONS.sword.windup(cut, set, held).blade;
        const wound = poseOf("weapon", 0.5, set, cut, { set, turn: 0 }, held).blade;
        assert.ok(fromGuard(wound) > fromGuard(plain), `${JSON.stringify(cut)} from ${name}: further from guard`);
        assert.ok(wound.z < plain.z, `${JSON.stringify(cut)} from ${name}: further back`);
      }
    }
  });

  test("the draw-back carries into the drive and is gone by the time the blade goes live", () => {
    const { goneByTurn } = DRAWBACK;
    for (const cut of CUTS) {
      const driven = poseOf("weapon", 0.5, 0.95, cut, { set: 1, turn: 0 }).blade;
      assert.ok(driven.z < MOTIONS.sword.stroke(cut, 0).blade.z, `${JSON.stringify(cut)}: still back as it drives`);
      const live = poseOf("weapon", 0, 0, cut, { set: 1, turn: goneByTurn });
      assert.deepEqual(live.blade, MOTIONS.sword.stroke(cut, goneByTurn).blade, JSON.stringify(cut));
    }
  });

  test("each way winds up on its own side, the blade drawn to where its cut starts, every way told apart", () => {
    const wound = WAYS.map((way) => poseOf("weapon", 0.5, 0.9, wayCut(way, true), { set: 0.9, turn: 0 }).blade);
    SWING_DIRS.forEach((way) => {
      const blade = wound[WAYS.indexOf(way)]!, start = { x: -SCREEN_DIR[way].x, y: -SCREEN_DIR[way].y };
      if (Math.abs(start.x) > 0.1) assert.equal(Math.sign(blade.x), Math.sign(start.x), `${way} across`);
      if (Math.abs(start.y) > 0.1) assert.equal(Math.sign(blade.y), Math.sign(start.y), `${way} up or down`);
    });
    for (let a = 0; a < wound.length; a++) {
      for (let b = a + 1; b < wound.length; b++) {
        const [u, w] = [wound[a]!, wound[b]!], cos = u.x * w.x + u.y * w.y + u.z * w.z;
        assert.ok(cos < Math.cos(0.4), `${WAYS[a]} and ${WAYS[b]} look alike`);
      }
    }
  });

  test("a stab's wind-up draws the sword hand back behind the guard", () => {
    const guard = poseOf("approach", 0, 0, wayCut("stab", true), null);
    const wound = poseOf("weapon", 0.5, 0.9, wayCut("stab", true), { set: 0.9, turn: 0 });
    assert.ok(wound.hand.z < guard.hand.z - 0.2, `${wound.hand.z} vs ${guard.hand.z}`);
  });

  test("the body leans back further with the draw-back", () => {
    assert.ok(poseOf("weapon", 1, 1, LR).lean < -0.12 - KOBOLD_DRAWBACK.leanRad / 2);
  });

  test("the draw-back turns the body toward the blade's side", () => {
    const { turnRad } = KOBOLD_DRAWBACK, drawn = { set: 1, turn: 0 };
    const at = (cut: Cut) => poseOf("weapon", 0.5, 0.95, cut, drawn);
    assert.ok(at(LR).twist > turnRad && at(LR).hipTwist > 0);
    assert.ok(at(RL).twist < -turnRad && at(RL).hipTwist < 0);
  });

  test("a high wind-up rears the chest back", () => {
    const high = poseOf("weapon", 0.5, 0.95, TB, { set: 1, turn: 0 });
    assert.ok(high.bend < -KOBOLD_DRAWBACK.bendRad, `${high.bend}`);
  });

  test("a heavy's tell is bigger: held, it rears back further; wound up, the blade is drawn further back", () => {
    assert.ok(poseOf("weaponWindup", 0.5, 1, TB, null, TOP_GUARD, true).lean
      < poseOf("weaponWindup", 0.5, 1, TB, null, TOP_GUARD, false).lean);
    for (const cut of [TLBR, TRBL]) {
      const at = (heavy: boolean) => poseOf("weapon", 0.5, 0.9, cut, { set: 0.9, turn: 0 }, TOP_GUARD, heavy);
      assert.ok(at(true).blade.z < at(false).blade.z, JSON.stringify(cut));
      assert.ok(at(true).lean < at(false).lean, JSON.stringify(cut));
    }
  });

  test("dead it falls over; stunned it sees stars, but not just staggered", () => {
    assert.equal(poseOf("dead", 0, 0, LR).roll, Math.PI / 2);
    assert.equal(poseOf("stunned", 0.1, 0, LR).stars, true);
    assert.equal(poseOf("staggered", 0.1, 0, LR).stars, false);
    assert.deepEqual(poseOf("staggered", 0.1, 0, TB, null).blade, poseOf("stunned", 0.1, 0, TB, null).blade);
  });
});
