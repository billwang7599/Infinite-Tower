import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, TransformNode, Vector3, type AbstractMesh } from "@babylonjs/core";
import { DEFAULT_LOOK, type SwingData, type Vec3 } from "@infinite-tower/shared";
import { CAMERA_VIEWS } from "../../../src/modes/battle/camera.js";
import { orbitBack } from "../../../src/modes/orbit.js";
import { firstPersonArms, holdInView, POSED_FOR, restShoulders } from "../../../src/visuals/battle/firstPerson.js";
import { newPerson } from "../../../src/visuals/battle/person/animation.js";
import { buildPerson, personBuild } from "../../../src/visuals/battle/person/model.js";
import type { Sky } from "../../../src/visuals/sky/sky.js";
import { personPose, type PersonPose } from "../../../src/visuals/battle/person/pose.js";
import { restInModel } from "../../../src/visuals/battle/person/skeleton.js";
import { MOTIONS, WEAPON_LOOKS } from "../../../src/visuals/battle/weapons.js";
import { playerDoing } from "../../fixtures/players.js";
import { swingSteps } from "../../fixtures/swings.js";

const BUILD = personBuild(DEFAULT_LOOK);
const TAN = Math.tan(CAMERA_VIEWS.fp.fovRad / 2);
/** Inside this share of the screen's half-height from its middle, either way (so in view at any width over height). */
const IN_VIEW = 0.9;
const BOW = WEAPON_LOOKS["training-bow"];

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const along = (p: Vec3, d: Vec3, m: number): Vec3 => ({ x: p.x + d.x * m, y: p.y + d.y * m, z: p.z + d.z * m });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

function onScreen(p: Vec3): { x: number; y: number; depthM: number } {
  const { eye, right, up, forward } = POSED_FOR, d = sub(p, eye), depthM = dot(d, forward);
  return { x: dot(d, right) / depthM / TAN, y: dot(d, up) / depthM / TAN, depthM };
}

function assertInView(p: Vec3, what: string): void {
  const s = onScreen(p);
  assert.ok(s.depthM > 0.1 && Math.abs(s.x) <= IN_VIEW && Math.abs(s.y) <= IN_VIEW,
    `${what}: at ${s.x.toFixed(2)}, ${s.y.toFixed(2)} (${s.depthM.toFixed(2)} m)`);
}

const moment = { build: BUILD, alive: true, dodge: { x: 0, z: 1 }, stagger: { left: 0, of: 0 }, deadTime: 0, time: 0 };
const still = { phase: 0, speed: 0, way: { x: 0, z: 1 } };
const swordPose = (player = playerDoing("none", 0), swing: SwingData | null = null, side: 1 | -1 = 1, walk = still) =>
  personPose(player, { swing }, MOTIONS.sword, { ...moment, side, walk });
const bowPose = (player: ReturnType<typeof playerDoing>, drawn: number) =>
  personPose(player, { swing: null }, MOTIONS.bow, { ...moment, side: -1, walk: still, bow: { ...BOW.bow!, drawn } });

function swordPoses(): [string, PersonPose][] {
  const poses: [string, PersonPose][] = [
    ["rest", swordPose()], ["block", swordPose(playerDoing("block", 1))], ["chant", swordPose(playerDoing("chant", 1))],
    ["cast", swordPose(playerDoing("cast", 1))], ["left-handed", swordPose(playerDoing("none", 0), null, -1)],
  ];
  for (let phase = 0; phase < 2 * Math.PI; phase += 0.5) {
    poses.push([`walk ${phase}`, swordPose(playerDoing("none", 0), null, 1, { ...still, phase, speed: 6 })]);
  }
  for (const attack of ["light", "heavy"] as const) {
    for (const way of ["lr", "rl", "tb", "tlbr", "trbl", "bltr", "brtl", "stab"] as const) {
      for (const swing of swingSteps(attack, way)) {
        poses.push([`${attack} ${way} step ${swing.step}`, swordPose(playerDoing("attack", 0), swing)]);
      }
    }
  }
  return poses;
}

describe("first person: your arms and what they hold always in view", () => {
  test("the sword: both hands and the blade's near half, at rest, walking, blocking, chanting and every swing", () => {
    const shoulder = restInModel("upper_arm.R", BUILD.look.body);
    for (const [what, pose] of swordPoses()) {
      const side = what === "left-handed" ? -1 : 1, arms = firstPersonArms(pose, side, false);
      assertInView(arms.hand, `${what}: the sword hand`);
      assertInView(arms.offHand, `${what}: the other hand`);
      for (const share of [0, 0.25, 0.5]) {
        assertInView(along(arms.hand, arms.blade, WEAPON_LOOKS.sword.blade.lengthM * share), `${what}: blade ${share}`);
      }
      const reachM = Math.hypot(arms.hand.x - side * shoulder.x, arms.hand.y - shoulder.y, arms.hand.z - shoulder.z);
      assert.ok(reachM < BUILD.reachM, `${what}: out of reach (${reachM})`);
    }
  });

  test("the bow: both hands and the stave above the grip, carried, drawing and loosed", () => {
    const poses: [string, PersonPose][] = [["carried", bowPose(playerDoing("none", 1), 0)]];
    for (const drawn of [0, 0.5, 1]) poses.push([`drawn ${drawn}`, bowPose(playerDoing("draw", drawn), drawn)]);
    poses.push(["loosed", bowPose(playerDoing("loose", 0.05), 1)]);
    for (const [what, pose] of poses) {
      const arms = firstPersonArms(pose, -1, what !== "carried");
      assertInView(arms.hand, `${what}: the bow hand`);
      assertInView(arms.offHand, `${what}: the string hand`);
      for (const share of [0, 0.25]) {
        assertInView(along(arms.hand, arms.blade, BOW.blade.lengthM * share), `${what}: stave ${share}`);
      }
    }
  });

  test("a two-handed grip, or the hand on a bowstring, stays where it was on the weapon", () => {
    const pose = swordPose(playerDoing("attack", 0), swingSteps("heavy", "rl")[4]!);
    const offHand = along(pose.hand, pose.blade, -0.18), arms = firstPersonArms({ ...pose, offHand }, 1, true);
    const grip = sub(arms.offHand, arms.hand);
    assert.ok(Math.abs(Math.hypot(grip.x, grip.y, grip.z) - 0.18) < 1e-9, "as far down the grip");
    assert.ok(Math.abs(dot(grip, arms.blade) + 0.18) < 1e-9, "along the blade");
  });

  test("at rest the sword sits lower and nearer the middle than the third person's pose would show it", () => {
    const pose = swordPose(), arms = firstPersonArms(pose, 1, false), lengthM = WEAPON_LOOKS.sword.blade.lengthM;
    const before = onScreen(along(pose.hand, pose.blade, lengthM));
    const after = onScreen(along(arms.hand, arms.blade, lengthM));
    assert.ok(after.y < before.y - 0.1, `tip from ${before.y} to ${after.y}`);
    assert.ok(Math.abs(after.x) < Math.abs(before.x), `tip from ${before.x} to ${after.x}`);
  });
});

describe("first person: the arms go with the camera", () => {
  test("wherever it looks, up, down or off to the side, the hands are where the posed-for view shows them", () => {
    const scene = new Scene(new NullEngine()), sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;
    const node = new TransformNode("player", scene);
    node.position.set(2, 0.7, -1);
    const model = buildPerson({ scene, sky }, 1, node, BUILD);
    model.holder.rotation.y = 0.4;
    const pose = swordPose(), person = { ...newPerson(), model, look: DEFAULT_LOOK, bladeSide: 1 as const };
    person.handAt = new Vector3(pose.hand.x, pose.hand.y, pose.hand.z);
    const blade = new Vector3(pose.blade.x, pose.blade.y, pose.blade.z);
    person.bladeTurn = Quaternion.FromUnitVectorsToRef(Vector3.Up(), blade, Quaternion.Identity());
    const want = onScreen(firstPersonArms(pose, 1, false).hand);
    for (const [yaw, pitch] of [[0.4, CAMERA_VIEWS.fp.lockPitchRad], [0.4, -1.2], [0.4, 1.3], [1.5, 0.2]] as const) {
      const fp = CAMERA_VIEWS.fp, back = orbitBack(yaw, pitch), o = { x: 2, y: 0.7 + fp.orbitHeightM, z: -1 };
      const view = {
        yaw, pitch, fovRad: fp.fovRad, eye: { x: o.x + back.x * fp.distanceM, y: o.y + back.y * fp.distanceM,
          z: o.z + back.z * fp.distanceM }, at: { x: o.x - back.x, y: o.y - back.y, z: o.z - back.z },
      };
      restShoulders(person);
      holdInView(person, view, false);
      const hand = model.joints["hand.R"].getAbsolutePosition(), forward = { x: -back.x, y: -back.y, z: -back.z };
      const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
      const up = { x: forward.y * right.z - forward.z * right.y, y: forward.z * right.x - forward.x * right.z,
        z: forward.x * right.y - forward.y * right.x };
      const d = sub(hand, view.eye), depthM = dot(d, forward);
      const got = { x: dot(d, right) / depthM / TAN, y: dot(d, up) / depthM / TAN };
      const off = Math.max(Math.abs(got.x - want.x), Math.abs(got.y - want.y));
      assert.ok(off < 0.02 && Math.abs(depthM - want.depthM) < 0.01, `yaw ${yaw}, pitch ${pitch}: ${off} off`);
    }
    scene.dispose();
  });
});
