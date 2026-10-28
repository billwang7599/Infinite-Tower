import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  attackShape, FIXED_DT, PLAYER, reverseOf, SWING_DIRS, WEAPONS, type SwingDir,
} from "@infinite-tower/shared";
import { MOTIONS, SCREEN_DIR, swingFrame, type TrailPose } from "../../../src/visuals/battle/weapons.js";
import { swingSteps } from "../../fixtures/swings.js";

const { trail: trailPose, thrust: thrustPose, windup: windupBlade, live: liveBlade } = MOTIONS.sword;
const STAB_RANGE = attackShape("stab", PLAYER.armReachM, WEAPONS.sword).range;

const trail = (aimYaw: number, dir: SwingDir): TrailPose[] =>
  swingSteps(dir, aimYaw).map(trailPose).filter((pose) => pose !== null);
/** Where on screen (seen from behind: x right, y up) the trail's growing tip is. */
const onScreen = (pose: TrailPose) => {
  const along = pose.from * (1 - 2 * pose.reach);
  return { x: along * Math.cos(pose.rollRad), y: along * Math.sin(pose.rollRad) };
};

describe("a swing's frames", () => {
  test("winding up, then live, then following through", () => {
    const frames = swingSteps("lr").map(swingFrame);
    const { liveAt, liveUntil } = swingSteps("lr")[0]!;
    assert.deepEqual(frames, frames.map((_, step) => (step < liveAt ? 0 : step < liveUntil ? 1 : 2)));
  });
});

describe("the sword trail", () => {
  test("goes across the screen the way the swing goes, as the player sees it", () => {
    for (const dir of SWING_DIRS) {
      const poses = trail(0, dir);
      assert.ok(poses.length > 0, `${dir} shows a trail`);
      const from = onScreen(poses[0]!), to = onScreen(poses.at(-1)!);
      const move = { x: to.x - from.x, y: to.y - from.y }, len = Math.hypot(move.x, move.y);
      const want = SCREEN_DIR[dir];
      assert.ok(len > 1.5, `${dir} goes from one end of its line to the other`);
      assert.ok((move.x * want.x + move.y * want.y) / len > 0.99, `${dir} goes ${JSON.stringify(move)}`);
    }
  });

  test("each swing's reverse goes back the same way along the same line", () => {
    const line = (dir: SwingDir) => trail(0, dir)[0]!.rollRad;
    for (const dir of SWING_DIRS) {
      assert.equal(line(reverseOf(dir)), line(dir), dir);
      assert.deepEqual(SCREEN_DIR[reverseOf(dir)], { x: -SCREEN_DIR[dir].x || 0, y: -SCREEN_DIR[dir].y || 0 });
    }
  });

  test("a swing draws the same trail, around its own aim, whatever that aim is", () => {
    const [first, ...rest] = [0, 0.8, -1.5].map((yaw) => trail(yaw, "lr"));
    rest.forEach((poses, i) => assert.deepEqual(poses, first, `aim ${i + 2} is like the first`));
  });

  test("the stab draws no trail but a thrust, out as far as the weapon stabs and back, while its blade is live", () => {
    const stab = swingSteps("stab"), reach = STAB_RANGE;
    assert.equal(stab.map(trailPose).filter((pose) => pose !== null).length, 0);
    const thrusts = stab.map((swing) => thrustPose(swing, STAB_RANGE));
    thrusts.forEach((pose, step) => {
      const t = (step - stab[0]!.liveAt) * FIXED_DT;
      if (t < -0.03) assert.equal(pose, null, `not before its blade goes live (${t.toFixed(3)} s)`);
    });
    assert.ok(thrusts.some((pose) => pose !== null && pose.reachM > 0.8 * reach), "it reaches out");
    assert.ok(thrusts.every((pose) => pose === null || pose.reachM <= reach));
    for (const dir of SWING_DIRS) assert.ok(swingSteps(dir).every((s) => thrustPose(s, STAB_RANGE) === null), dir);
  });
});

describe("a held blade", () => {
  test("winds up from guard to where its swing starts, then sweeps through straight ahead to the other end", () => {
    const start = windupBlade("lr", 1).blade, mid = liveBlade("lr", 0.5).blade, end = liveBlade("lr", 1).blade;
    assert.ok(start.x > 0.5 && end.x < -0.5, "across, the way it goes");
    assert.ok(mid.z > 0.9, "straight ahead halfway");
  });

  test("a stab draws the hand back, then thrusts it out", () => {
    assert.ok(windupBlade("stab", 1).handZ < windupBlade("stab", 0).handZ);
    assert.ok(liveBlade("stab", 0.5).handZ > windupBlade("stab", 0).handZ);
  });
});
