import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import {
  Body, Enemy, FIXED_DT, Health, newWielder, Skilled, WAYS, Wielder, World, type EnemyData, type EnemyState,
  type Entity, type SkilledData, type SwingData,
} from "@infinite-tower/shared";
import { Blend } from "../../../../src/modes/battle/context.js";
import { BLADE_FROM_M } from "../../../../src/visuals/battle/blade.js";
import { HIT_STOP_MS, type HitStop } from "../../../../src/visuals/battle/impact.js";
import type { ArenaScene } from "../../../../src/visuals/battle/scene.js";
import { ROUNDNESS } from "../../../../src/visuals/battle/person/loft.js";
import { MOTIONS, strokeOf, wayCut, WEAPON_LOOKS } from "../../../../src/visuals/battle/weapons.js";
import { GREATSWORD_BUILD } from "../../../../src/visuals/enemies/kobold-greatsword/animation.js";
import { koboldSwordsmanVisual, reachKobold } from "../../../../src/visuals/enemies/kobold-swordsman/animation.js";
import {
  bellySections, buildKobold, SWORDSMAN_BUILD, torsoSections, type KoboldBuild,
} from "../../../../src/visuals/enemies/kobold-swordsman/model.js";
import { koboldPose } from "../../../../src/visuals/enemies/kobold-swordsman/pose.js";
import { alongSegment, armDepth, depthIn, type Loft } from "../../../fixtures/clearance.js";
import { swingAt, swingSteps } from "../../../fixtures/swings.js";

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

describe("a hit-stop on a kobold: its blade holds, then goes on with no jump", () => {
  const PER_SEC = 240;

  function run(contact: "hit" | "blocked" | null) {
    const scene = new Scene(new NullEngine()), world = new World(), e = world.spawn();
    world.add(e, Body, { pos: { x: 0, y: 0.9, z: 0 }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
    world.add(e, Health, { hp: 30, max: 30, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });
    world.add(e, Skilled, { chanting: false, casting: null } as unknown as SkilledData);
    const enemy = world.add(e, Enemy, { def: { radius: 0.5 }, state: "weapon", stateTime: 0, duration: 0.5, yaw: 0 } as
      unknown as EnemyData);
    const wielder = world.add(e, Wielder,
      newWielder({ rightHand: "kobold-blade", leftHand: null, active: "rightHand" }, ARM_REACH_M));
    const hitStops = new Map<Entity, HitStop>(), ctx = {
      scene, sky: { castShadows: () => {} }, nodes: new Map(), impacts: new Map(), hitStops, skills: {},
      materials: { slashFx: new StandardMaterial("slash", scene) }, battle: { blend: new Blend(), corrections: [] },
    } as unknown as ArenaScene;
    const drawn = koboldSwordsmanVisual.spawn(ctx, world, e), hand = drawn.drawing.swordArm.hand;
    const swing = swingAt("light", "lr", 0), contactAt = swing.liveAt + 1, frames = [];
    const tipM = BLADE_FROM_M + WEAPON_LOOKS["kobold-blade"].blade.lengthM;
    let struck = false, ended = false;
    for (let i = 0; i <= (swing.endAt * FIXED_DT + 0.3) * PER_SEC; i++) {
      const step = Math.floor(i / PER_SEC / FIXED_DT);
      if (!ended) swing.step = step;
      if (contact && step >= contactAt && !struck) {
        hitStops.set(e, { ageMs: 0 });
        struck = true;
        ended = contact === "blocked";
      }
      wielder.swing = !ended && step < swing.endAt ? swing : null;
      Object.assign(enemy, { state: wielder.swing ? "weapon" : "weaponRecover", stateTime: i / PER_SEC });
      koboldSwordsmanVisual.frame(drawn, world, e, 1 / PER_SEC);
      const at = hand.computeWorldMatrix(true);
      frames.push({
        grip: Vector3.TransformCoordinates(Vector3.Zero(), at),
        tip: Vector3.TransformCoordinates(new Vector3(0, tipM, 0), at),
        held: (hitStops.get(e)?.ageMs ?? Infinity) <= HIT_STOP_MS - 1000 / PER_SEC,
      });
    }
    scene.dispose();
    return frames;
  }

  const moved = (a: { grip: Vector3; tip: Vector3 }, b: { grip: Vector3; tip: Vector3 }) =>
    Math.max(Vector3.Distance(a.grip, b.grip), Vector3.Distance(a.tip, b.tip));

  for (const contact of ["hit", "blocked"] as const) {
    test(`a ${contact} swing`, () => {
      const free = run(null), stopped = run(contact);
      const fastest = Math.max(...free.slice(1).map((f, i) => moved(f, free[i]!)));
      const held = stopped.flatMap((f, i) => f.held ? [i] : []);
      assert.ok(held.length >= Math.floor((HIT_STOP_MS / 1000) * PER_SEC) - 2, `${held.length} frames held`);
      for (const i of held.slice(1)) assert.ok(moved(stopped[i]!, stopped[i - 1]!) < 1e-6, `still on frame ${i}`);
      for (let i = held[0]!; i < stopped.length; i++) {
        const m = moved(stopped[i]!, stopped[i - 1]!);
        assert.ok(m <= fastest, `${m.toFixed(3)} m on frame ${i}: a jump`);
      }
    });
  }
});
