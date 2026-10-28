import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, emptyBag, PARRY, PLAYER, starterEquipment, type PlayerAction, type PlayerData,
} from "@infinite-tower/shared";
import { spritePose } from "../../../src/visuals/battle/pose.js";
import { BATTLE_FRAMES } from "../../../src/visuals/characters.js";
import { swingAt, swingSteps } from "../../fixtures/swings.js";

function playerDoing(action: PlayerAction, t: number): PlayerData {
  return {
    grounded: true, airTime: 0, jumpHeld: false, attackHeld: null, dodgeHeld: false,
    jumpBuffer: 0, attackBuffer: 0, dodgeBuffer: 0, castBuffer: 0, queued: null, castQueued: null,
    writeHeld: false, gearHeld: false, wordsHeld: false, brokenOff: false, writing: null, book: [],
    burden: "light", gear: { bag: emptyBag(), equipment: starterEquipment() },
    action, actionTime: t, actionDir: { x: 0, z: 1 },
  };
}
const ATTACKING = playerDoing("attack", 0);

describe("the player's sprite", () => {
  test("every attack plays its pose's frames: wind-up, strike while the blade is live, follow-through", () => {
    for (const attack of ATTACK_KINDS) {
      const steps = swingSteps(attack);
      const poses = steps.map((swing) => spritePose(ATTACKING, swing, true, 1));
      const name = attack === "stab" ? "stab" : `swing-${attack}`;
      for (const pose of poses) assert.ok(pose.scaleX > 0, `${attack} isn't mirrored`);
      poses.forEach((pose, step) => {
        const { liveAt, liveUntil } = steps[step]!;
        assert.equal(pose.pose, name, `${attack} at step ${step}`);
        assert.equal(pose.frame, step < liveAt ? 0 : step < liveUntil ? 1 : 2, `${attack} at step ${step}`);
      });
      assert.ok(poses.some((pose) => pose.frame === 2), `${attack} follows through`);
    }
  });

  test("blocking raises the sword, then braces; staggered, knocked back for half of it, then stumbling", () => {
    const pose = (action: PlayerAction, t: number, stagger = { left: 0, of: 0 }) => {
      const { pose, frame } = spritePose(playerDoing(action, t), null, true, 1, stagger);
      return [pose, frame];
    };
    assert.deepEqual(pose("block", 0.05), ["block", 0]);
    assert.deepEqual(pose("block", 0.15), ["block", 1]);
    for (const of of [PARRY.playerStaggerTime, PLAYER.block.guardBreakTime]) {
      assert.deepEqual(pose("stagger", 0.1, { left: of * 0.6, of }), ["stagger", 0], `${of} s`);
      assert.deepEqual(pose("stagger", 0.1, { left: of * 0.4, of }), ["stagger", 1], `${of} s`);
    }
    assert.deepEqual(pose("none", 0.1), ["stand", 0]);
    assert.deepEqual(spritePose(playerDoing("none", 0.1), null, false, 1).pose, "down");
    assert.deepEqual(spritePose(ATTACKING, swingAt("lr", 3), false, 1).pose, "down");
  });

  test("every frame it picks is drawn", () => {
    const all = ATTACK_KINDS.flatMap((attack) => swingSteps(attack))
      .map((swing) => spritePose(ATTACKING, swing, true, 1));
    for (const t of [0, 0.05, 0.15, 1]) {
      for (const action of ["block", "stagger", "none"] as const) {
        for (const left of [0, 0.2, 0.4, 0.8]) {
          all.push(spritePose(playerDoing(action, t), null, true, 1, { left, of: 0.8 }));
        }
      }
    }
    all.push(spritePose(playerDoing("none", 0), null, false, 1));
    for (const { pose, frame } of all) assert.ok(frame >= 0 && frame < BATTLE_FRAMES[pose], `${pose} ${frame}`);
  });
});
