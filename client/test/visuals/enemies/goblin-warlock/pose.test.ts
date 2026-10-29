import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { goblinPose } from "../../../../src/visuals/enemies/goblin-warlock/pose.js";

describe("the goblin's pose", () => {
  test("chanting it holds the staff up before it, the orb glowing brighter word by word", () => {
    const idle = goblinPose("approach", 0, 0);
    const early = goblinPose("skillChant", 0.2, 1), late = goblinPose("skillChant", 1, 3);
    assert.ok(early.staffPitch < idle.staffPitch);
    assert.ok(late.glow > early.glow && early.glow > idle.glow);
  });

  test("chanting it lifts its free hand before it", () => {
    const idle = goblinPose("approach", 0, 0).offHand, chanting = goblinPose("skillChant", 0.2, 1).offHand;
    assert.ok(chanting.y > idle.y && chanting.z > idle.z);
  });

  test("a cast's wind-up thrusts the staff forward, glowing full", () => {
    const pose = goblinPose("skillCast", 0.2, 0);
    assert.ok(pose.handZ > goblinPose("approach", 0, 0).handZ);
    assert.equal(pose.glow, 1);
  });

  test("the poke draws the staff back, then jabs it level", () => {
    const back = goblinPose("lungeWindup", 0.3, 0), jab = goblinPose("lunge", 0.05, 0);
    assert.ok(back.handZ < goblinPose("approach", 0, 0).handZ);
    assert.ok(jab.handZ > back.handZ);
    assert.ok(Math.abs(jab.staffPitch - Math.PI / 2) < 0.3);
  });

  test("dead it falls over; staggered it reels and sees stars", () => {
    assert.equal(goblinPose("dead", 0, 0).roll, Math.PI / 2);
    const reeling = goblinPose("staggered", 0.1, 0);
    assert.equal(reeling.stars, true);
    assert.ok(reeling.lean < 0);
  });
});
