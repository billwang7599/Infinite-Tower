import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { followStun, noStun, STUN_CUE, type Stun } from "../../../src/modes/battle/stun.js";

const FRAME_TIME = 1 / 60;

function stunFor(time: number, frames: number, stun: Stun = noStun()): Stun {
  let hitstun = time;
  followStun(stun, hitstun, FRAME_TIME);
  for (let i = 0; i < frames; i++) {
    hitstun = Math.max(0, hitstun - FRAME_TIME);
    followStun(stun, hitstun, FRAME_TIME);
  }
  return stun;
}

const framesOf = (time: number) => Math.round(time / FRAME_TIME);

describe("the stun cue", () => {
  test("shows nothing with no stun", () => {
    const stun = noStun();
    followStun(stun, 0, FRAME_TIME);
    assert.deepEqual([stun.shown, stun.rollRad, stun.pitchRad], [0, 0, 0]);
  });

  test("comes in quickly on a hit, shows through the stun and is gone the moment it ends", () => {
    const time = 0.8;
    assert.ok(stunFor(time, framesOf(STUN_CUE.fadeInTime) + 1).shown === 1);
    assert.equal(stunFor(time, framesOf(time / 2)).shown, 1);
    const ending = stunFor(time, framesOf(time) - 3).shown;
    assert.ok(ending > 0 && ending < 1, `${ending}`);
    assert.equal(stunFor(time, framesOf(time) + 1).shown, 0);
  });

  test("the stun's time left drains from all of it to none", () => {
    const time = 0.8, half = stunFor(time, framesOf(time / 2));
    assert.equal(half.of, time);
    assert.ok(Math.abs(half.left / half.of - 0.5) < 0.05);
  });

  test("a short stun still shows, weaker than a long one", () => {
    const short = stunFor(0.25, framesOf(0.1)), long = stunFor(STUN_CUE.fullStrengthTime, framesOf(0.1));
    assert.ok(short.shown > 0);
    assert.equal(short.strength, STUN_CUE.minStrength);
    assert.equal(long.strength, 1);
  });

  test("the camera kicks on the hit and is level again once the stun is over", () => {
    const kicked = stunFor(0.8, framesOf(STUN_CUE.kickPeakTime));
    assert.ok(Math.abs(kicked.rollRad) > 0.5 * STUN_CUE.kickRollRad * kicked.strength);
    assert.ok(kicked.pitchRad > 0);
    for (const time of [0.25, 0.5, 0.8, 1.5]) {
      const after = stunFor(time, framesOf(time) + 2);
      assert.ok(Math.abs(after.rollRad) < 0.002, `${time}: ${after.rollRad}`);
      assert.ok(Math.abs(after.pitchRad) < 0.002, `${time}: ${after.pitchRad}`);
    }
  });

  test("never sways the camera more than a few degrees", () => {
    const stun = noStun();
    let hitstun = 2, most = 0;
    for (let i = 0; i < framesOf(2.5); i++) {
      followStun(stun, hitstun, FRAME_TIME);
      most = Math.max(most, Math.abs(stun.rollRad), Math.abs(stun.pitchRad));
      hitstun = Math.max(0, hitstun - FRAME_TIME);
    }
    assert.ok(most > 0 && most < (4 * Math.PI) / 180, `${most}`);
  });

  test("a correction nudging the hitstun keeps the stun going; a new hit starts it again", () => {
    const stun = stunFor(0.8, framesOf(0.4)), age = stun.age, side = stun.side;
    followStun(stun, stun.left + 2 * FRAME_TIME, FRAME_TIME);
    assert.ok(stun.age > age);
    followStun(stun, 0.8, FRAME_TIME);
    assert.equal(stun.age, 0);
    assert.equal(stun.of, 0.8);
    assert.equal(stun.side, -side);
  });
});
