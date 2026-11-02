import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SlamDef } from "@infinite-tower/shared";
import { lurkerPose } from "../../../../src/visuals/enemies/bog-lurker/pose.js";

const SLAM = { windup: 1.3, lockAt: 0.35, active: 0.15, sweep: { windup: 0.75, active: 0.2 } } as SlamDef;

describe("the bog lurker's pose", () => {
  test("it lies low in the bog while it walks, and rises out of it over its wind-up, rearing back", () => {
    const low = lurkerPose("approach", 0, SLAM);
    const early = lurkerPose("slamWindup", 0.2, SLAM), top = lurkerPose("slamWindup", SLAM.windup - SLAM.lockAt, SLAM);
    assert.ok(low.sink > early.sink && early.sink > top.sink);
    assert.ok(top.lean < early.lean && top.lean < 0 && top.arms > early.arms);
  });

  test("it shakes as it rises, then holds still once its line is locked", () => {
    assert.ok(lurkerPose("slamWindup", 0.5, SLAM).tremble > 0);
    assert.equal(lurkerPose("slamWindup", SLAM.windup - 0.05, SLAM).tremble, 0);
  });

  test("the slam throws it forward, arms down", () => {
    const top = lurkerPose("slamWindup", SLAM.windup, SLAM), down = lurkerPose("slam", SLAM.active, SLAM);
    assert.ok(down.lean > 0 && down.arms < top.arms);
  });

  test("it coils before the sweep, then turns a whole circle", () => {
    assert.ok(lurkerPose("sweepWindup", SLAM.sweep.windup, SLAM).spin < 0);
    assert.ok(Math.abs(lurkerPose("sweep", SLAM.sweep.active, SLAM).spin - 2 * Math.PI) < 1e-9);
  });

  test("dead, it rolls over and sinks", () => {
    const dead = lurkerPose("dead", 0);
    assert.equal(dead.roll, Math.PI / 2);
    assert.ok(dead.sink > lurkerPose("approach", 0).sink);
  });
});
