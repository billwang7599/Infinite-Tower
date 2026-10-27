import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, CHAIN, liveStep, reverseOf, SWING_DIRS, type AttackKind, type PlayerAction, type PlayerData,
  type SwingDir,
} from "@infinite-tower/shared";
import {
  SCREEN_DIR, spritePose, thrustPose, trailPose, type TrailPose,
} from "../../../src/battle/player/pose.js";

const FRAME_TIME = 1 / 60;
const STARTUP = CHAIN.startupTime.opening;

/** What the controller leaves in Player `t` seconds into `attack`, aimed at `aimYaw` (radians). */
function attackAt(attack: AttackKind, t: number, aimYaw = 0, action: PlayerAction = "attack"): PlayerData {
  return {
    grounded: true, airTime: 0, jumpHeld: false, attackHeld: null, dodgeHeld: false,
    jumpBuffer: 0, attackBuffer: 0, dodgeBuffer: 0, queued: null, burden: "light",
    action, actionTime: t, actionDir: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) },
    attack, startup: STARTUP, power: 1, combo: null, comboTime: 0, momentum: 0,
  };
}

/** Every frame of an attack, from the press until it ends. */
function frames(attack: AttackKind, aimYaw = 0): PlayerData[] {
  const out: PlayerData[] = [];
  for (let t = 0; t < STARTUP + CHAIN.activeTime + CHAIN.recoverTime; t += FRAME_TIME) out.push(attackAt(attack, t, aimYaw));
  return out;
}

const trail = (all: PlayerData[]): TrailPose[] => all.map(trailPose).filter((pose) => pose !== null);
/** Where on screen (seen from behind: x right, y up) the trail's growing tip is. */
const onScreen = (pose: TrailPose) => {
  const along = pose.from * (1 - 2 * pose.reach);
  return { x: along * Math.cos(pose.rollRad), y: along * Math.sin(pose.rollRad) };
};

describe("the player's sprite", () => {
  test("every attack has its own pose, named for the art to come (the slash frame stands in for now)", () => {
    for (const attack of ATTACK_KINDS) {
      const poses = frames(attack).map((player) => spritePose(player, true, 1));
      const name = attack === "stab" ? "stab" : `swing-${attack}`;
      assert.ok(poses.some((pose) => pose.pose === name), `${attack} shows ${name}`);
      for (const pose of poses) assert.ok(pose.scaleX > 0, `${attack} isn't mirrored`);
      assert.ok(poses.some((pose) => pose.frame === "slash"), attack);
    }
  });

  test("blocking, staggered, standing and down each have their pose", () => {
    const pose = (action: PlayerAction, alive = true) => spritePose(attackAt("lr", 0.1, 0, action), alive, 1).pose;
    assert.equal(pose("block"), "block");
    assert.equal(pose("stagger"), "stagger");
    assert.equal(pose("none"), "stand");
    assert.equal(pose("none", false), "down");
  });
});

describe("the sword trail", () => {
  test("goes across the screen the way the swing goes, as the player sees it", () => {
    for (const dir of SWING_DIRS) {
      const poses = trail(frames(dir));
      assert.ok(poses.length > 0, `${dir} shows a trail`);
      const from = onScreen(poses[0]!), to = onScreen(poses.at(-1)!);
      const move = { x: to.x - from.x, y: to.y - from.y }, len = Math.hypot(move.x, move.y);
      const want = SCREEN_DIR[dir];
      assert.ok(len > 1.5, `${dir} goes from one end of its line to the other`);
      assert.ok((move.x * want.x + move.y * want.y) / len > 0.99, `${dir} goes ${JSON.stringify(move)}`);
    }
  });

  test("each swing's reverse goes back the same way along the same line", () => {
    const line = (dir: SwingDir) => trail(frames(dir))[0]!.rollRad;
    for (const dir of SWING_DIRS) {
      assert.equal(line(reverseOf(dir)), line(dir), dir);
      assert.deepEqual(SCREEN_DIR[reverseOf(dir)], { x: -SCREEN_DIR[dir].x || 0, y: -SCREEN_DIR[dir].y || 0 });
    }
  });

  test("every swing of a combo draws the same trail, around its own aim", () => {
    const [first, ...rest] = [0, 0.8, -1.5].map((yaw) => trail(frames("lr", yaw)));
    rest.forEach((poses, i) => assert.deepEqual(poses, first, `swing ${i + 2} is like the first`));
  });

  test("the stab draws no trail but a thrust, out and back while its blade is live", () => {
    assert.equal(trail(frames("stab")).length, 0);
    const thrusts = frames("stab").map(thrustPose);
    const live = liveStep(STARTUP) * FRAME_TIME;
    thrusts.forEach((pose, i) => {
      const t = i * FRAME_TIME;
      if (t < live - 0.03) assert.equal(pose, null, `not before its blade goes live (${t.toFixed(3)} s)`);
    });
    assert.ok(thrusts.some((pose) => pose !== null && pose.reach > 0.8), "it reaches out");
    for (const dir of SWING_DIRS) assert.ok(frames(dir).every((p) => thrustPose(p) === null), dir);
  });
});
