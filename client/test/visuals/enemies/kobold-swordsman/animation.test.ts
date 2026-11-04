import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { FIXED_DT, WAYS, type EnemyState, type SwingData } from "@infinite-tower/shared";
import { BLADE_FROM_M } from "../../../../src/visuals/battle/blade.js";
import { ROUNDNESS } from "../../../../src/visuals/battle/person/loft.js";
import { MOTIONS, strokeOf, wayCut, WEAPON_LOOKS } from "../../../../src/visuals/battle/weapons.js";
import { GREATSWORD_BUILD } from "../../../../src/visuals/enemies/kobold-greatsword/animation.js";
import { reachKobold } from "../../../../src/visuals/enemies/kobold-swordsman/animation.js";
import {
  bellySections, buildKobold, SWORDSMAN_BUILD, torsoSections, type KoboldBuild,
} from "../../../../src/visuals/enemies/kobold-swordsman/model.js";
import { koboldPose } from "../../../../src/visuals/enemies/kobold-swordsman/pose.js";
import { alongSegment, armDepth, depthIn, type Loft } from "../../../fixtures/clearance.js";
import { swingSteps } from "../../../fixtures/swings.js";

const TOLERANCE_M = 0.003;
const ARM_REACH_M = 0.8;

function deepest(build: KoboldBuild, weapon: "kobold-blade" | "kobold-greatsword"): { depthM: number; where: string } {
  const scene = new Scene(new NullEngine()), ctx = { scene, sky: { castShadows: () => {} } } as never;
  const look = WEAPON_LOOKS[weapon];
  const def = { radius: 0.5 } as never;
  const m = buildKobold(ctx, 1, new TransformNode("kobold", scene), def, 0, look, ARM_REACH_M, build);
  const lofts: Loft[] = [torsoSections(build.bulk), bellySections(build.bulk)].map((sections) => ({
    node: m.chest, sections, roundness: ROUNDNESS,
  }));
  const motion = MOTIONS.sword, held = motion.held(wayCut("tb", true));
  let worst = { depthM: 0, where: "" };
  const check = (what: string, state: EnemyState, t: number, k: number, swing: SwingData | null, gaitM = 0) => {
    const p = koboldPose(state, t, k, wayCut(swing?.way ?? "tb", true), motion, swing && strokeOf(swing), held,
      swing?.attack === "heavy");
    m.hips.rotation.y = p.hipTwist;
    m.chest.rotation.set(p.bend, p.twist, 0);
    m.model.rotation.set(p.lean, 0, p.roll);
    m.model.position.y = p.yOff;
    const hand = m.swordArm.hand;
    hand.rotationQuaternion = new Quaternion();
    const blade = new Vector3(p.blade.x, p.blade.y, p.blade.z);
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), blade, hand.rotationQuaternion);
    reachKobold(m, p.hand, { ...p.offHand, z: p.offHand.z - gaitM }, look);
    for (const [which, arm] of [["sword", m.swordArm], ["off", m.offArm]] as const) {
      const c = arm.clearance!, { depthM, part } = armDepth(lofts, arm, c, c.upperFrom);
      if (depthM > worst.depthM) worst = { depthM, where: `${which} ${part}, ${what}` };
    }
    hand.computeWorldMatrix(true);
    const edge = (y: number) => Vector3.TransformCoordinates(new Vector3(0, y, 0), hand.getWorldMatrix());
    for (const at of alongSegment(edge(BLADE_FROM_M), edge(BLADE_FROM_M + look.blade.lengthM), 20)) {
      const depthM = depthIn(lofts, at, look.blade.widthM / 2);
      if (depthM > worst.depthM) worst = { depthM, where: `the blade, ${what}` };
    }
  };
  check("on guard", "approach", 0.5, 0.5, null);
  for (const gaitM of [-0.17, 0.17]) check(`walking, the free hand ${gaitM} m`, "approach", 0.5, 0.5, null, gaitM);
  for (const state of ["stunned", "staggered", "dead"] as const) {
    for (const t of [0, 0.1, 0.3]) check(`${state} at ${t} s`, state, t, 0.5, null);
  }
  for (const attack of ["light", "heavy"] as const) {
    for (const way of WAYS) {
      for (const s of swingSteps(attack, way)) {
        const k = Math.min(1, s.step / s.endAt), what = `${attack} ${way} step ${s.step}`;
        check(what, s.step < s.liveUntil ? "weapon" : "weaponRecover", s.step * FIXED_DT, k, s);
        if (s.step < s.driveAt) check(`${what}, its tell`, "weaponWindup", s.step * FIXED_DT, s.step / s.driveAt, s);
      }
    }
  }
  scene.dispose();
  return worst;
}

describe("the kobolds' arms go round their bodies", () => {
  test("on guard, swinging either way, reeling and down, no arm, fist or blade passes into the torso", () => {
    const kobolds = [[SWORDSMAN_BUILD, "kobold-blade"], [GREATSWORD_BUILD, "kobold-greatsword"]] as const;
    for (const [build, weapon] of kobolds) {
      const { depthM, where } = deepest(build, weapon);
      assert.ok(depthM <= TOLERANCE_M, `${weapon}: ${(depthM * 100).toFixed(1)} cm in, ${where}`);
    }
  });
});
