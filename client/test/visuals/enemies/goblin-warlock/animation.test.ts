import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import type { EnemyState } from "@infinite-tower/shared";
import { poseArm } from "../../../../src/visuals/battle/arm.js";
import { STAFF_HAND_X } from "../../../../src/visuals/enemies/goblin-warlock/animation.js";
import { buildGoblin, GOWN, GOWN_ROUNDNESS } from "../../../../src/visuals/enemies/goblin-warlock/model.js";
import { goblinPose } from "../../../../src/visuals/enemies/goblin-warlock/pose.js";
import { armDepth, type Loft } from "../../../fixtures/clearance.js";

const TOLERANCE_M = 0.003;
const STATES: EnemyState[] = [
  "approach", "skillChant", "skillCast", "lungeWindup", "lunge", "lungeRecover", "stunned", "staggered", "dead",
];

describe("the goblin's arms go round its gown", () => {
  test("in every state, walking or not, no sleeve or hand passes into the gown below the shoulder", () => {
    const scene = new Scene(new NullEngine()), ctx = { scene, sky: { castShadows: () => {} } } as never;
    const m = buildGoblin(ctx, 1, new TransformNode("goblin", scene), { radius: 0.45 } as never, 0);
    const lofts: Loft[] = [{ node: m.model, sections: GOWN, roundness: GOWN_ROUNDNESS }];
    let worst = { depthM: 0, where: "" };
    for (const state of STATES) {
      for (const t of [0, 0.3, 1]) {
        for (const gaitM of [-0.14, 0, 0.14]) {
          const p = goblinPose(state, t, 2);
          m.model.rotation.set(p.lean, 0, p.roll);
          m.model.position.y = p.yOff;
          m.staffArm.hand.rotation.x = p.staffPitch;
          poseArm(m.staffArm, { x: STAFF_HAND_X, y: p.handY, z: p.handZ });
          poseArm(m.offArm, { ...p.offHand, z: p.offHand.z - gaitM });
          for (const [which, arm] of [["staff", m.staffArm], ["off", m.offArm]] as const) {
            const c = arm.clearance!, { depthM, part } = armDepth(lofts, arm, c, c.upperFrom);
            if (depthM > worst.depthM) worst = { depthM, where: `${which} ${part}, ${state} at ${t} s, ${gaitM} m` };
          }
        }
      }
    }
    assert.ok(worst.depthM <= TOLERANCE_M, `${(worst.depthM * 100).toFixed(1)} cm in, ${worst.where}`);
    scene.dispose();
  });
});
