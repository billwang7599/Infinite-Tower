import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ChargeDef, LungeDef } from "@infinite-tower/shared";
import { boarPose } from "../../../../src/visuals/enemies/wild-boar/pose.js";

const LUNGE = { windup: 0.6, recover: 0.5 } as LungeDef;
const CHARGE = { windup: 1, recover: 0.8, lockAt: 0.3 } as ChargeDef;

describe("the boar's pose", () => {
  test("a lunge's wind-up lowers the head further the longer it winds up, then the tusks sweep up", () => {
    const early = boarPose("lungeWindup", LUNGE.windup * 0.25, LUNGE);
    const late = boarPose("lungeWindup", LUNGE.windup, LUNGE);
    assert.ok(early.headPitch > 0 && late.headPitch > early.headPitch);
    assert.ok(boarPose("lunge", 0, LUNGE).headPitch < 0);
  });

  test("a charge's wind-up paws the ground, glows and shows the line, brighter as it nears", () => {
    const early = boarPose("chargeWindup", 0.1, undefined, CHARGE);
    const late = boarPose("chargeWindup", 0.6, undefined, CHARGE);
    assert.notEqual(early.legs[1], null);
    assert.ok(late.glow > early.glow && late.telegraph! > early.telegraph!);
    assert.equal(boarPose("approach", 0).telegraph, null);
  });

  test("stunned it sees stars; dead it lies on its side, legs out", () => {
    assert.equal(boarPose("stunned", 0.2).stars, true);
    const dead = boarPose("dead", 0);
    assert.equal(dead.roll, Math.PI / 2);
    assert.ok(dead.legs.every((leg) => leg !== null));
  });
});
