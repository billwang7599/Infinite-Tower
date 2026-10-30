import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  followingBlade, restingBlade, reverseOf, type AttackKind, type Blade, type EnemyState, type SwingDir, type Vec3,
} from "@infinite-tower/shared";
import { KOBOLD_DRAWBACK, koboldPose } from "../../../../src/visuals/enemies/kobold-swordsman/pose.js";
import { MOTIONS } from "../../../../src/visuals/battle/weapons.js";

const poseOf = (
  state: EnemyState, t: number, k: number, attack: AttackKind, stroke: { set: number; turn: number } | null = {
    set: k, turn: 0,
  }, blade: Blade = restingBlade(),
) => koboldPose(state, t, k, attack, MOTIONS.sword, stroke, blade);

describe("the kobold's pose", () => {
  test("a swing's wind-up turns the blade to where the swing starts: its only tell", () => {
    assert.ok(poseOf("weaponWindup", 1, 1, "lr").blade.x > 0.5);
  });

  test("a stab's wind-up draws the hand back", () => {
    assert.ok(poseOf("weaponWindup", 1, 1, "stab").hand.z < poseOf("approach", 0, 0, "stab").hand.z);
  });

  test("from the drive on the blade is exactly where its stroke is: straight ahead halfway", () => {
    const mid = poseOf("weapon", 0.06, 0.5, "lr", { set: 1, turn: 0.5 });
    assert.equal(mid.bladeExact, true);
    assert.ok(mid.blade.z > 0.9);
    assert.equal(poseOf("weaponWindup", 0.1, 0.2, "lr", { set: 1, turn: 0.1 }).bladeExact, true, "driven");
    assert.equal(poseOf("weaponWindup", 0.1, 0.2, "lr", { set: 0.5, turn: 0 }).bladeExact, false, "being set");
  });

  test("it follows through as it starts to recover, then eases to its recovery", () => {
    const following = poseOf("weaponRecover", 0.1, 0.1, "lr", { set: 1, turn: 0.9 });
    assert.equal(following.bladeExact, true);
    assert.ok(following.blade.x < -0.5, "on the swing's far side");
    assert.equal(poseOf("weaponRecover", 0.5, 0.5, "lr", null).bladeExact, false);
  });

  test("between swings its blade stays where the last one left it, until its next wind-up turns it away", () => {
    const stopped = followingBlade("lr", 0), out = MOTIONS.sword.held(stopped).blade;
    for (const state of ["approach", "weaponRecover"] as const) {
      assert.deepEqual(poseOf(state, 0.5, 0.5, "lr", null, stopped).blade, out, state);
    }
    assert.deepEqual(poseOf("weaponWindup", 0, 0, "tb", { set: 0, turn: 0 }, stopped).blade, out, "not yet moved");
  });

  test("the sword hand goes with the blade: out to the side wound up, ahead mid-cut", () => {
    const guard = poseOf("approach", 0, 0, "lr"), wound = poseOf("weaponWindup", 1, 1, "lr");
    const mid = poseOf("weapon", 0.06, 0.5, "lr", { set: 1, turn: 0.5 });
    assert.ok(wound.hand.x > guard.hand.x);
    assert.ok(mid.hand.z > wound.hand.z);
  });

  test("the body leads the blade: coiled wound up, already turned the swing's way mid-cut, carried past it", () => {
    const wound = poseOf("weaponWindup", 1, 1, "lr");
    const mid = poseOf("weapon", 0.06, 0.5, "lr", { set: 1, turn: 0.5 });
    const past = poseOf("weaponRecover", 0.1, 0.1, "lr", { set: 1, turn: 1.1 });
    assert.ok(wound.twist > 0 && wound.hipTwist > 0);
    assert.ok(Math.abs(mid.blade.x) < 0.2, "the blade is only straight ahead");
    assert.ok(mid.twist < 0 && mid.hipTwist < 0, "the body is already turned past it");
    assert.ok(past.twist < mid.twist);
  });

  const guard = MOTIONS.sword.held(restingBlade()).blade;
  const fromGuard = (v: Vec3): number => Math.acos(Math.min(1, v.x * guard.x + v.y * guard.y + v.z * guard.z));
  const swings: SwingDir[] = ["lr", "rl", "tb", "trbl", "bltr"];

  test("a wind-up draws the blade back past its plain path, wider and behind, on an opener and a chained swing", () => {
    for (const attack of swings) {
      for (const [name, blade] of [["opener", restingBlade()], ["chained", followingBlade(reverseOf(attack), 0)]] as const) {
        const set = 0.9, plain = MOTIONS.sword.windup(attack, set, MOTIONS.sword.held(blade)).blade;
        const wound = poseOf("weaponWindup", 0.5, set, attack, { set, turn: 0 }, blade).blade;
        assert.ok(fromGuard(wound) > fromGuard(plain), `${attack} ${name}: further from guard`);
        assert.ok(wound.z < plain.z, `${attack} ${name}: further back`);
      }
    }
  });

  test("the draw-back carries into the drive and is gone by the time the blade goes live", () => {
    const { goneByTurn } = KOBOLD_DRAWBACK;
    for (const attack of swings) {
      const driven = poseOf("weaponWindup", 0.5, 0.95, attack, { set: 1, turn: 0 }).blade;
      assert.ok(driven.z < MOTIONS.sword.stroke(attack, 0).blade.z, `${attack}: still back as the drive starts`);
      const live = poseOf("weapon", 0, 0, attack, { set: 1, turn: goneByTurn });
      assert.deepEqual(live.blade, MOTIONS.sword.stroke(attack, goneByTurn).blade, attack);
    }
  });

  test("the body leans back further with the draw-back", () => {
    const wound = poseOf("weaponWindup", 1, 1, "lr");
    assert.ok(wound.lean < -0.12 - KOBOLD_DRAWBACK.leanRad / 2);
  });

  test("the draw-back turns the body: toward the blade's side for a swing, the sword shoulder back for a stab", () => {
    const { turnRad } = KOBOLD_DRAWBACK, drawn = { set: 1, turn: 0 };
    const at = (attack: AttackKind) => poseOf("weaponWindup", 0.5, 0.95, attack, drawn);
    assert.ok(at("lr").twist > turnRad && at("lr").hipTwist > 0);
    assert.ok(at("rl").twist < -turnRad && at("rl").hipTwist < 0);
    assert.ok(Math.abs(at("stab").twist - turnRad) < 1e-9);
    assert.ok(at("stab").hipTwist > 0);
  });

  test("a high wind-up rears the chest back, a low one hunches it over", () => {
    const { bendRad } = KOBOLD_DRAWBACK, drawn = { set: 1, turn: 0 };
    const high = poseOf("weaponWindup", 0.5, 0.95, "tb", drawn), low = poseOf("weaponWindup", 0.5, 0.95, "bt", drawn);
    assert.ok(high.bend < -bendRad, `${high.bend}`);
    assert.ok(low.bend > bendRad, `${low.bend}`);
  });

  test("a stab's hand starts its thrust drawn further back than its plain stroke, and is on it once live", () => {
    const { goneByTurn, stabM } = KOBOLD_DRAWBACK, stroke = MOTIONS.sword.stroke;
    const drawn = poseOf("weaponWindup", 0.5, 0.95, "stab", { set: 1, turn: 0 });
    const live = poseOf("weapon", 0, 0, "stab", { set: 1, turn: goneByTurn });
    assert.deepEqual(live.blade, stroke("stab", goneByTurn).blade);
    const plainTravel = stroke("stab", goneByTurn).handZ - stroke("stab", 0).handZ;
    assert.ok(Math.abs(live.hand.z - drawn.hand.z - (plainTravel + stabM)) < 1e-9);
  });

  test("dead it falls over; parried it sees stars", () => {
    assert.equal(poseOf("dead", 0, 0, "lr").roll, Math.PI / 2);
    assert.equal(poseOf("parried", 0.1, 0, "lr").stars, true);
  });
});
