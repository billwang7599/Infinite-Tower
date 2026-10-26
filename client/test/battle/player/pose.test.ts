import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PLAYER, type PlayerData } from "@infinite-tower/shared";
import { spritePose, trailPose, type TrailPose } from "../../../src/battle/player/pose.js";

const FRAME_TIME = 1 / 60;

/** What the controller leaves in Player `t` seconds into a swing aimed at `aimYaw` (radians). */
function swingAt(aimYaw: number, t: number): PlayerData {
  return {
    grounded: true, airTime: 0, jumpHeld: false, attackHeld: false, dodgeHeld: false,
    jumpBuffer: 0, attackBuffer: 0, dodgeBuffer: 0, burden: "light",
    action: "slash", actionTime: t, actionDir: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) },
  };
}

/** Every frame of a swing, from the press until the next swing of the combo may start. */
function swing(aimYaw: number): PlayerData[] {
  const out: PlayerData[] = [];
  for (let t = 0; t < PLAYER.slash.chainAfter; t += FRAME_TIME) out.push(swingAt(aimYaw, t));
  return out;
}

/** A combo of three swings, the camera turned between them. */
const COMBO = [0, 0.8, -1.5].map(swing);
const trail = (frames: PlayerData[]): TrailPose[] => frames.map(trailPose).filter((pose) => pose !== null);

describe("the swing's sprite and trail", () => {
  test("every swing of a combo shows the slash frame and is never mirrored", () => {
    COMBO.forEach((frames, i) => {
      const poses = frames.map((player) => spritePose(player, true, 1));
      assert.ok(poses.some((pose) => pose.frame === "slash"), `swing ${i + 1} shows the slash frame`);
      for (const pose of poses) assert.ok(pose.scaleX > 0, `swing ${i + 1} isn't mirrored`);
    });
  });

  test("every swing's trail starts on our right, the slash frame's sword side, and sweeps to our left", () => {
    COMBO.forEach((frames, i) => {
      const poses = trail(frames);
      assert.ok(poses.length > 0, `swing ${i + 1} shows a trail`);
      assert.ok(poses[0]!.yawRad > 0, `swing ${i + 1} starts on our right`);
      assert.ok(poses.at(-1)!.yawRad < 0, `swing ${i + 1} ends on our left`);
    });
  });

  test("every swing of a combo draws the same trail, around its own aim", () => {
    const [first, ...rest] = COMBO.map(trail);
    rest.forEach((poses, i) => assert.deepEqual(poses, first, `swing ${i + 2} is like the first`));
  });
});
