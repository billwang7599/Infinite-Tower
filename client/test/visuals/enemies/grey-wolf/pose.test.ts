import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PounceDef } from "@infinite-tower/shared";
import { wolfPose } from "../../../../src/visuals/enemies/grey-wolf/pose.js";

const POUNCE = { windup: 0.6, lockAt: 0.2, active: 0.35, hopTime: 0.3 } as PounceDef;

describe("the wolf's pose", () => {
  test("its wind-up crouches lower and lower, head down and shaking, then holds still once it locks", () => {
    const early = wolfPose("pounceWindup", 0.1, POUNCE), late = wolfPose("pounceWindup", 0.38, POUNCE);
    assert.ok(late.crouch > early.crouch && early.crouch > 0);
    assert.ok(late.headPitch > 0 && late.tremble > 0);
    assert.equal(wolfPose("pounceWindup", POUNCE.windup - 0.05, POUNCE).tremble, 0);
  });

  test("it leaps in an arc with its jaws open, and hops back out low", () => {
    const mid = wolfPose("pounce", POUNCE.active / 2, POUNCE);
    assert.ok(mid.lift > wolfPose("pounce", 0, POUNCE).lift && mid.jaw > 0);
    const hop = wolfPose("pounceHop", POUNCE.hopTime / 2, POUNCE);
    assert.ok(hop.lift > 0 && hop.lift < mid.lift);
  });

  test("dead, it lies on its side, legs out", () => {
    const dead = wolfPose("dead", 0);
    assert.equal(dead.roll, Math.PI / 2);
    assert.ok(dead.legs.every((leg) => leg !== null));
  });
});
