import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, emptyBag, followingBlade, PARRY, PLAYER, restingBlade, starterEquipment, SWING_DIRS,
  type Blade, type PlayerAction, type PlayerData, type SwingData,
} from "@infinite-tower/shared";
import { facingSeen, spritePose, TURN_MARGIN_RAD } from "../../../src/visuals/battle/pose.js";
import { BATTLE_FRAMES } from "../../../src/visuals/characters.js";
import { swingAt, swingSteps } from "../../fixtures/swings.js";

function playerDoing(action: PlayerAction, t: number): PlayerData {
  return {
    grounded: true, airTime: 0, jumpHeld: false, attackHeld: null, dodgeHeld: false,
    jumpBuffer: 0, attackBuffer: 0, dodgeBuffer: 0, castBuffer: 0, queued: null, castQueued: null,
    writeHeld: false, gearHeld: false, wordsHeld: false, brokenOff: false, writing: null, book: [],
    burden: "light", gear: { bag: emptyBag(), equipment: starterEquipment() },
    action, actionTime: t, actionDir: { x: 0, z: 1 }, invulnerable: false, leftArena: false,
  };
}
const ATTACKING = playerDoing("attack", 0);
const holding = (swing: SwingData | null, blade: Blade = restingBlade()) => ({ swing, blade });

describe("the player's sprite", () => {
  test("every attack plays its pose's frames in turn: wind-up, strike as its blade goes live, follow-through", () => {
    for (const attack of ATTACK_KINDS) {
      const steps = swingSteps(attack);
      const poses = steps.map((swing) => spritePose(ATTACKING, holding(swing), true, 1));
      const name = attack === "stab" ? "stab" : `swing-${attack}`;
      for (const pose of poses) assert.ok(pose.scaleX > 0, `${attack} isn't mirrored`);
      const { driveAt, liveAt } = steps[0]!;
      for (const pose of poses) assert.equal(pose.pose, name, attack);
      assert.deepEqual(poses.map((p) => p.frame), poses.map((p) => p.frame).sort(), `${attack}: in order`);
      assert.equal(poses[driveAt]!.frame, 0, `${attack}: wound up as the drive starts`);
      assert.equal(poses[liveAt]!.frame, 1, `${attack}: striking as it goes live`);
      assert.ok(poses.some((pose) => pose.frame === 2), `${attack} follows through`);
    }
  });

  test("blocking raises the sword, then braces; staggered, knocked back for half of it, then stumbling", () => {
    const pose = (action: PlayerAction, t: number, stagger = { left: 0, of: 0 }) => {
      const { pose, frame } = spritePose(playerDoing(action, t), holding(null), true, 1, stagger);
      return [pose, frame];
    };
    assert.deepEqual(pose("block", 0.05), ["block", 0]);
    assert.deepEqual(pose("block", 0.15), ["block", 1]);
    for (const of of [PARRY.playerStaggerTime, PLAYER.block.guardBreakTime]) {
      assert.deepEqual(pose("stagger", 0.1, { left: of * 0.6, of }), ["stagger", 0], `${of} s`);
      assert.deepEqual(pose("stagger", 0.1, { left: of * 0.4, of }), ["stagger", 1], `${of} s`);
    }
    assert.deepEqual(pose("none", 0.1), ["stand", 0]);
    assert.deepEqual(spritePose(playerDoing("none", 0.1), holding(null), false, 1).pose, "down");
    assert.deepEqual(spritePose(ATTACKING, holding(swingAt("lr", 3)), false, 1).pose, "down");
  });

  test("between swings it holds the sword out where the last swing left it, until it's back at rest", () => {
    for (const dir of SWING_DIRS) {
      const out = spritePose(playerDoing("none", 1), holding(null, followingBlade(dir, 0)), true, 1);
      assert.deepEqual([out.pose, out.frame], [`swing-${dir}`, 2], dir);
    }
    assert.equal(spritePose(playerDoing("none", 1), holding(null), true, 1).pose, "stand");
    const blocking = spritePose(playerDoing("block", 1), holding(null, followingBlade("lr", 0)), true, 1);
    assert.equal(blocking.pose, "block");
  });

  test("every frame it picks is drawn", () => {
    const all = ATTACK_KINDS.flatMap((attack) => swingSteps(attack))
      .map((swing) => spritePose(ATTACKING, holding(swing), true, 1));
    for (const t of [0, 0.05, 0.15, 1]) {
      for (const action of ["block", "stagger", "none"] as const) {
        for (const left of [0, 0.2, 0.4, 0.8]) {
          all.push(spritePose(playerDoing(action, t), holding(null), true, 1, { left, of: 0.8 }));
        }
      }
    }
    all.push(spritePose(playerDoing("none", 0), holding(null), false, 1));
    for (const { pose, frame } of all) assert.ok(frame >= 0 && frame < BATTLE_FRAMES[pose], `${pose} ${frame}`);
  });
});

describe("the side of a player the camera sees", () => {
  const at = { x: 2, z: -1 };
  const seen = (yaw: number, offRad: number, was: "back" | "front") => {
    const eye = { x: at.x + 6 * Math.sin(yaw + offRad), y: 3, z: at.z + 6 * Math.cos(yaw + offRad) };
    return facingSeen(eye, at, { x: Math.sin(yaw), z: Math.cos(yaw) }, was);
  };
  const YAWS = [0, 1, 2.5, -2, Math.PI];

  test("their back with the camera behind them, their front with it ahead of them, whichever way they face", () => {
    for (const yaw of YAWS) {
      for (const was of ["back", "front"] as const) {
        assert.equal(seen(yaw, Math.PI, was), "back", `yaw ${yaw}, behind`);
        assert.equal(seen(yaw, 0.3, was), "front", `yaw ${yaw}, ahead`);
        assert.equal(seen(yaw, -1.2, was), "front", `yaw ${yaw}, ahead to the side`);
        assert.equal(seen(yaw, 2, was), "back", `yaw ${yaw}, behind to the side`);
      }
    }
  });

  test("side-on, it keeps the side it showed until the camera is past side-on by the margin", () => {
    for (const yaw of YAWS) {
      for (const side of [1, -1]) {
        const sideOn = side * Math.PI / 2, margin = side * TURN_MARGIN_RAD;
        for (const was of ["back", "front"] as const) {
          assert.equal(seen(yaw, sideOn, was), was, `yaw ${yaw}, side-on`);
          assert.equal(seen(yaw, sideOn - margin * 0.9, was), was, `yaw ${yaw}, just ahead`);
          assert.equal(seen(yaw, sideOn + margin * 0.9, was), was, `yaw ${yaw}, just behind`);
        }
        assert.equal(seen(yaw, sideOn - margin * 1.1, "back"), "front", `yaw ${yaw}, past side-on ahead`);
        assert.equal(seen(yaw, sideOn + margin * 1.1, "front"), "back", `yaw ${yaw}, past side-on behind`);
      }
    }
  });
});
