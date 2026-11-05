import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, TransformNode, Vector3, type AbstractMesh } from "@babylonjs/core";
import {
  DEFAULT_LOOK, FIXED_DT, SCREEN_DIR, SWING_DIRS, WAYS, WEAPONS, type Entity, type GuardKind, type PlayerAction,
  type SwingData, type SwingDir, type Vec3, type Way, type WeaponId,
} from "@infinite-tower/shared";
import { CAMERA_VIEWS, insideSelf } from "../../../src/modes/battle/camera.js";
import { orbitBack } from "../../../src/modes/orbit.js";
import { BLADE_FROM_M, holdBlade, SHIELD } from "../../../src/visuals/battle/blade.js";
import { ARROW_M, pullString } from "../../../src/visuals/battle/bow.js";
import { moveBow, restingBow, type BowDraw, type BowMotion } from "../../../src/visuals/battle/bowMotion.js";
import {
  bowInView, FP_ARMS, FP_BOW, FP_SWING, firstPersonArms, fpShare, guardInView, holdInView, POSED_FOR, restShoulders,
  swungInView,
} from "../../../src/visuals/battle/firstPerson.js";
import type { ArenaScene } from "../../../src/visuals/battle/scene.js";
import {
  GUARD_SHIFT, guardShiftTime, newPerson, OFF_GRIP_M, reachArms, type PersonDrawing,
} from "../../../src/visuals/battle/person/animation.js";
import { buildPerson, personBuild } from "../../../src/visuals/battle/person/model.js";
import type { Sky } from "../../../src/visuals/sky/sky.js";
import { personPose, type PersonPose } from "../../../src/visuals/battle/person/pose.js";
import { restInModel } from "../../../src/visuals/battle/person/skeleton.js";
import { GUARD_LEAN, MOTIONS, WEAPON_LOOKS } from "../../../src/visuals/battle/weapons.js";
import { playerDoing } from "../../fixtures/players.js";
import { swingAt, swingSteps } from "../../fixtures/swings.js";

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

function assertInView(p: Vec3, what: string, inside = IN_VIEW): void {
  const s = onScreen(p);
  assert.ok(s.depthM > 0.1 && Math.abs(s.x) <= inside && Math.abs(s.y) <= inside,
    `${what}: at ${s.x.toFixed(2)}, ${s.y.toFixed(2)} (${s.depthM.toFixed(2)} m)`);
}

const moment = { build: BUILD, alive: true, dodge: { x: 0, z: 1 }, stagger: { left: 0, of: 0 }, deadTime: 0, time: 0 };
const still = { phase: 0, speed: 0, way: { x: 0, z: 1 } };
const swordPose = (player = playerDoing("none", 0), swing: SwingData | null = null, side: 1 | -1 = 1, walk = still) =>
  personPose(player, { swing }, MOTIONS.sword, { ...moment, side, walk });
const aimed = (pull: number): BowMotion => ({ ...restingBow(), raise: 1, hand: pull, goal: pull, string: pull });
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
  return poses;
}

const SHOULDER = restInModel("upper_arm.R", BUILD.look.body);
const assertInReach = (hand: Vec3, side: 1 | -1, what: string) => {
  const reachM = Math.hypot(hand.x - side * SHOULDER.x, hand.y - SHOULDER.y, hand.z - SHOULDER.z);
  assert.ok(reachM < BUILD.reachM, `${what}: out of reach (${reachM})`);
};

describe("first person: your arms and what they hold always in view", () => {
  test("the sword: both hands and the blade's near half, at rest, walking, blocking and chanting", () => {
    for (const [what, pose] of swordPoses()) {
      const side = what === "left-handed" ? -1 : 1, arms = firstPersonArms(pose, side, false);
      assertInView(arms.hand, `${what}: the sword hand`);
      assertInView(arms.offHand, `${what}: the other hand`);
      for (const share of [0, 0.25, 0.5]) {
        assertInView(along(arms.hand, arms.blade, WEAPON_LOOKS.sword.blade.lengthM * share), `${what}: blade ${share}`);
      }
      assertInReach(arms.hand, side, what);
    }
  });

  test("swinging, the sword hand stays in view and in reach and the blade on screen, either hand", () => {
    for (const side of [1, -1] as const) {
      for (const attack of ["light", "heavy"] as const) {
        for (const way of ["lr", "rl", "tb", "tlbr", "trbl", "bltr", "brtl", "stab"] as const) {
          for (const swing of swingSteps(attack, way)) {
            const what = `${side} ${attack} ${way} step ${swing.step}`, { hand, holding } = swungInView(swing, 1, side);
            const blade = Vector3.Up().applyRotationQuaternion(holding);
            assertInView(hand, `${what}: the sword hand`);
            assertInView(along(hand, blade, BLADE_FROM_M), `${what}: the foot of the blade`, 1);
            assertInReach(hand, side, what);
          }
        }
      }
    }
  });

  test("the bow: both hands and the stave above the grip, carried, drawing and loosed", () => {
    const states: [string, BowMotion][] = [["carried", restingBow()]];
    for (const pull of [0, 0.5, 1]) states.push([`drawn ${pull}`, aimed(pull)]);
    states.push(["loosed", { ...aimed(1), string: 0, flick: 1, loosed: true, sinceLoose: 0.05 }]);
    for (const [what, m] of states) {
      const arms = bowInView(m, BOW.bow!), stave = Vector3.Up().applyRotationQuaternion(arms.holding);
      assertInView(arms.hand, `${what}: the bow hand`);
      assertInView(arms.offHand, `${what}: the string hand`);
      for (const share of [0, 0.25]) {
        assertInView(along(arms.hand, stave, BOW.blade.lengthM * share), `${what}: stave ${share}`);
      }
    }
  });

  test("a two-handed grip holds the weapon below the sword hand, as the body's does", () => {
    const arms = firstPersonArms(swordPose(playerDoing("attack", 0), swingSteps("heavy", "rl")[4]!), 1, true);
    const grip = sub(arms.offHand, arms.hand);
    assert.ok(Math.abs(Math.hypot(grip.x, grip.y, grip.z) - OFF_GRIP_M) < 1e-9, "as far down the grip");
    assert.ok(Math.abs(dot(grip, arms.blade) + OFF_GRIP_M) < 1e-9, "along the blade");
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
    const pose = swordPose(), person = { ...newPerson(), model, look: DEFAULT_LOOK, bladeSide: 1 as const, pose };
    const want = onScreen(firstPersonArms(pose, 1, false).hand);
    for (const [yaw, pitch] of [[0.4, CAMERA_VIEWS.fp.lockPitchRad], [0.4, -1.2], [0.4, 1.3], [1.5, 0.2]] as const) {
      const fp = CAMERA_VIEWS.fp, back = orbitBack(yaw, pitch), o = { x: 2, y: 0.7 + fp.orbitHeightM, z: -1 };
      const view = {
        yaw, pitch, fovRad: fp.fovRad, eye: { x: o.x + back.x * fp.distanceM, y: o.y + back.y * fp.distanceM,
          z: o.z + back.z * fp.distanceM }, at: { x: o.x - back.x, y: o.y - back.y, z: o.z - back.z },
      };
      restShoulders(person);
      holdInView(person, view, 1, 0);
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

const CLEAR = 0.12;

function viewFrom(yaw: number, pitch: number, at: Vec3) {
  const fp = CAMERA_VIEWS.fp, back = orbitBack(yaw, pitch), o = { x: at.x, y: at.y + fp.orbitHeightM, z: at.z };
  const forward = { x: -back.x, y: -back.y, z: -back.z }, right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const up = { x: forward.y * right.z - forward.z * right.y, y: forward.z * right.x - forward.x * right.z,
    z: forward.x * right.y - forward.y * right.x };
  const eye = { x: o.x + back.x * fp.distanceM, y: o.y + back.y * fp.distanceM, z: o.z + back.z * fp.distanceM };
  const view = { yaw, pitch, fovRad: fp.fovRad, eye, at: { x: o.x - back.x, y: o.y - back.y, z: o.z - back.z } };
  const seen = (p: Vec3) => {
    const d = sub(p, eye), depthM = dot(d, forward);
    const across = dot(d, right), upward = dot(d, up);
    return { x: across / depthM / TAN, y: upward / depthM / TAN, depthM, right: across, up: upward };
  };
  return { view, forward, seen };
}

describe("first person: the drawn bow", () => {
  const scene = new Scene(new NullEngine()), sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;
  const node = new TransformNode("player", scene), feet = { x: 2, y: 0.7, z: -1 };
  node.position.set(feet.x, feet.y, feet.z);
  const model = buildPerson({ scene, sky }, 1, node, BUILD);
  model.holder.rotation.y = 0.4;
  const ctx = { scene, sky, bows: new Map() } as unknown as ArenaScene;
  const blade = holdBlade(ctx, 1 as Entity, model.joints["grip.L"], "training-bow", 0), bow = blade.bow!;
  const person = { ...newPerson(), model, look: DEFAULT_LOOK, bladeSide: -1 as const, blade };

  function drawnIn(pull: number, yaw: number, pitch: number) {
    const pose = bowPose(playerDoing("draw", pull), pull);
    for (const [name, r] of Object.entries(pose.joints)) {
      model.joints[name as keyof typeof pose.joints].rotation.set(r.x, r.y, r.z);
    }
    model.joints.root.position.y = pose.rootY;
    person.bow = aimed(pull);
    const { view, forward, seen } = viewFrom(yaw, pitch, feet);
    restShoulders(person);
    holdInView(person, view, 1, 0);
    pullString(bow, pull, true);
    const nockAt = bow.nocked.computeWorldMatrix(true).getTranslation();
    const way = Vector3.TransformNormal(Vector3.Forward(), bow.nocked.getWorldMatrix()).normalize();
    return { forward, seen, nockAt, way };
  }
  const VIEWS = [[0.4, CAMERA_VIEWS.fp.lockPitchRad], [0.4, -1.2], [0.4, 1.3], [1.5, 0.2]] as const;

  test("the nocked arrow lies along the view, so it points at the crosshair, wherever the camera looks", () => {
    for (const [yaw, pitch] of VIEWS) {
      for (const pull of [0, 0.5, 1]) {
        const { forward, nockAt, way, seen } = drawnIn(pull, yaw, pitch);
        const offRad = Math.acos(Math.min(1, Vector3.Dot(way, new Vector3(forward.x, forward.y, forward.z))));
        assert.ok(offRad < 2 * Math.PI / 180, `yaw ${yaw}, pitch ${pitch}, drawn ${pull}: ${offRad} rad off`);
        const at = seen(nockAt);
        assert.ok(Math.abs(at.right - FP_BOW.arrow.x) < 0.01 && Math.abs(at.up - FP_BOW.arrow.y) < 0.01,
          `yaw ${yaw}, pitch ${pitch}, drawn ${pull}: the arrow at ${at.right}, ${at.up}`);
      }
    }
  });

  test("the drawing hand holds the nock, nearer the eye the further it's drawn", () => {
    const depths = [0, 0.5, 1].map((pull) => {
      const { nockAt, seen } = drawnIn(pull, ...VIEWS[0]);
      const hand = model.joints["hand.R"].getAbsolutePosition();
      assert.ok(Vector3.Distance(hand, nockAt) < 0.015, `drawn ${pull}: ${Vector3.Distance(hand, nockAt)} m off`);
      return seen(hand).depthM;
    });
    assert.ok(depths[0]! > depths[1]! && depths[1]! > depths[2]!, `${depths}`);
    assert.ok(depths[0]! - depths[2]! > BOW.bow!.drawM / 2);
  });

  test("the crosshair stays clear: the stave, the arrow and both hands are off it, and the arrow in view", () => {
    for (const pull of [0, 0.5, 1]) {
      const { nockAt, way, seen } = drawnIn(pull, ...VIEWS[0]);
      const limbs = bow.limbs.computeWorldMatrix(true);
      const points = bow.path.map((p, i): [string, Vector3] => [`stave ${i}`, Vector3.TransformCoordinates(p, limbs)]);
      for (let k = 0; k <= 6; k++) points.push([`arrow ${k}`, nockAt.add(way.scale((ARROW_M * k) / 6))]);
      for (const s of ["L", "R"] as const) points.push([`hand ${s}`, model.joints[`hand.${s}`].getAbsolutePosition()]);
      for (const [what, p] of points) {
        const at = seen(p);
        if (at.depthM > 0) assert.ok(Math.hypot(at.x, at.y) > CLEAR, `drawn ${pull}, ${what}: ${at.x}, ${at.y}`);
      }
      const tip = seen(nockAt.add(way.scale(ARROW_M)));
      assert.ok(Math.abs(tip.x) < IN_VIEW && Math.abs(tip.y) < IN_VIEW, `drawn ${pull}: the tip at ${tip.x}, ${tip.y}`);
    }
  });

  test("frame to frame nothing jumps: raised, drawn, loosed, drawn again at once and lowered", () => {
    const at = (t: number): BowDraw => {
      const draw = (from: number) => ({ drawn: Math.min(1, (t - from) / 1), nocked: true, loosedTime: null });
      const loose = (from: number) => ({ drawn: 0, nocked: false, loosedTime: t - from });
      const carry = { drawn: 0, nocked: false, loosedTime: null };
      return t < 0.2 ? carry : t < 0.8 ? draw(0.2) : t < 1.1 ? loose(0.8) : t < 1.15 ? carry : t < 1.55 ? draw(1.15)
        : t < 1.85 ? loose(1.55) : carry;
    };
    const steps = (perSec: number) => {
      const m = restingBow();
      let last = bowInView(m, BOW.bow!), most = { hand: 0, offHand: 0, turnRad: 0 };
      for (let i = 1; i <= 2.5 * perSec; i++) {
        moveBow(m, at(i / perSec), 1 / perSec);
        const now = bowInView(m, BOW.bow!), step = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        const turnRad = 2 * Math.acos(Math.min(1, Math.abs(Quaternion.Dot(now.holding, last.holding))));
        most = { hand: Math.max(most.hand, step(now.hand, last.hand)),
          offHand: Math.max(most.offHand, step(now.offHand, last.offHand)), turnRad: Math.max(most.turnRad, turnRad) };
        last = now;
      }
      return most;
    };
    const at60 = steps(60), at240 = steps(240);
    for (const k of ["hand", "offHand", "turnRad"] as const) {
      assert.ok(at240[k] < at60[k] / 2.5, `${k}: ${at60[k]} a frame at 60 fps, ${at240[k]} at 240: a jump`);
    }
    assert.ok(at60.hand < 0.1 && at60.offHand < 0.1, `${at60.hand}, ${at60.offHand} m in a frame`);
  });
});

describe("first person: a sword swing", () => {
  const scene = new Scene(new NullEngine()), sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;
  const node = new TransformNode("player", scene), feet = { x: 2, y: 0.7, z: -1 };
  node.position.set(feet.x, feet.y, feet.z);
  const model = buildPerson({ scene, sky }, 1, node, BUILD);
  model.holder.rotation.y = 0.4;
  const ctx = { scene, sky, bows: new Map() } as unknown as ArenaScene;
  const blade = holdBlade(ctx, 1 as Entity, model.joints["grip.R"], "sword", 0);
  const { view, seen } = viewFrom(0.4, CAMERA_VIEWS.fp.lockPitchRad, feet);
  const grip = model.joints["grip.R"], lengthM = WEAPON_LOOKS.sword.blade.lengthM;
  const fresh = (): PersonDrawing => ({ ...newPerson(), model, look: DEFAULT_LOOK, bladeSide: 1, blade });
  // FOOT_M: the way the blade's foot points on screen, which the near plane never cuts.
  const NEAR_M = 0.05, FAR = 3, FOOT_M = 0.05;

  function bladeSeen(hand: Vector3, way: Vector3) {
    let from = hand.add(way.scale(BLADE_FROM_M)), to = hand.add(way.scale(BLADE_FROM_M + lengthM));
    const a = seen(from).depthM, b = seen(to).depthM;
    if (a < NEAR_M && b < NEAR_M) return null;
    if (a < NEAR_M) from = Vector3.Lerp(from, to, (NEAR_M - a) / (b - a));
    if (b < NEAR_M) to = Vector3.Lerp(from, to, (NEAR_M - a) / (b - a));
    const flat = (p: Vector3) => {
      const s = seen(p);
      return { x: Math.max(-FAR, Math.min(FAR, s.x)), y: Math.max(-FAR, Math.min(FAR, s.y)) };
    };
    const base = flat(from), tip = flat(to), foot = flat(from.add(way.scale(FOOT_M)));
    return { base, tip, angleRad: Math.atan2(foot.y - base.y, foot.x - base.x) };
  }

  function draw(p: PersonDrawing, swing: SwingData | null, alpha: number, dt: number, stance: SwingDir | null) {
    const pose = personPose(playerDoing(swing ? "attack" : "none", 0, stance), { swing }, MOTIONS.sword,
      { ...moment, side: 1, walk: still, alpha });
    p.pose = pose;
    restShoulders(p);
    holdInView(p, view, 1, dt);
    const hand = grip.getAbsolutePosition().clone();
    const way = Vector3.TransformNormal(Vector3.Up(), grip.getWorldMatrix()).normalize();
    return { hand, way, seen: bladeSeen(hand, way) };
  }

  function swingRun(attack: "light" | "heavy", way: Way, perSec: number, cutAt = Infinity) {
    const p = fresh(), swing = swingAt(attack, way, 0), startStep = Math.round(0.1 / FIXED_DT);
    const stance = way === "stab" ? null : way, frames = [];
    for (let i = 0; i <= (0.1 + swing.endAt * FIXED_DT + 0.4) * perSec; i++) {
      const clock = i / perSec / FIXED_DT + 0.5, ran = Math.floor(clock), alpha = clock - ran, step = ran - startStep;
      const swinging = step >= 1 && step <= swing.endAt && step < cutAt;
      swing.step = step;
      frames.push({ s: step - 1 + alpha, swinging, ...draw(p, swinging ? swing : null, alpha, 1 / perSec, stance) });
    }
    return frames;
  }

  const SLASHES = ["lr", "rl", "tlbr", "trbl", "bltr", "brtl"] as const;

  test("a slash sweeps the blade across the screen, from the side it starts on to the other", () => {
    for (const attack of ["light", "heavy"] as const) {
      for (const way of SLASHES) {
        const { driveAt, endAt } = swingAt(attack, way, 0), cut = SCREEN_DIR[way];
        const stroke = swingRun(attack, way, 60).filter((f) => f.s >= driveAt && f.s <= endAt && f.seen);
        let turnRad = 0;
        for (let i = 1; i < stroke.length; i++) {
          const d = stroke[i]!.seen!.angleRad - stroke[i - 1]!.seen!.angleRad;
          turnRad += Math.atan2(Math.sin(d), Math.cos(d));
        }
        assert.ok(Math.abs(turnRad) > (150 * Math.PI) / 180, `${attack} ${way}: turned ${turnRad} rad on screen`);
        const along = (f: (typeof stroke)[number]) => f.seen!.tip.x * cut.x + f.seen!.tip.y * cut.y;
        assert.ok(along(stroke[0]!) < -0.5, `${attack} ${way}: the tip starts at ${along(stroke[0]!)}`);
        assert.ok(along(stroke.at(-1)!) > 0.5, `${attack} ${way}: the tip ends at ${along(stroke.at(-1)!)}`);
      }
    }
  });

  test("the overhead chop comes down through the view, top to bottom", () => {
    for (const attack of ["light", "heavy"] as const) {
      const { driveAt, endAt } = swingAt(attack, "tb", 0);
      const stroke = swingRun(attack, "tb", 60).filter((f) => f.s >= driveAt && f.s <= endAt && f.seen);
      assert.ok(stroke[0]!.seen!.tip.y > 0.6, `${attack}: raised, the tip at ${stroke[0]!.seen!.tip.y}`);
      assert.ok(stroke.at(-1)!.seen!.tip.y < -0.6, `${attack}: down, the tip at ${stroke.at(-1)!.seen!.tip.y}`);
      for (let i = 1; i < stroke.length; i++) {
        assert.ok(stroke[i]!.seen!.tip.y <= stroke[i - 1]!.seen!.tip.y + 1e-9, `${attack}: back up at ${stroke[i]!.s}`);
      }
    }
  });

  test("on the step its hit lands, the blade crosses the middle of the screen", () => {
    for (const attack of ["light", "heavy"] as const) {
      for (const way of [...SLASHES, "tb", "stab"] as const) {
        const { liveAt } = swingAt(attack, way, 0), stance = way === "stab" ? null : way;
        const { seen: s } = draw(fresh(), swingAt(attack, way, liveAt), 1, FIXED_DT, stance);
        assert.ok(s, `${attack} ${way}: in view`);
        const dx = s.tip.x - s.base.x, dy = s.tip.y - s.base.y;
        const k = Math.max(0, Math.min(1, -(s.base.x * dx + s.base.y * dy) / (dx * dx + dy * dy)));
        const off = Math.hypot(s.base.x + dx * k, s.base.y + dy * k);
        assert.ok(off < 0.06, `${attack} ${way}: ${off} from the middle`);
      }
    }
  });

  // A pop is as big at any frame rate; motion shrinks with the frame.
  test("frame to frame nothing jumps: into a swing, through it, out of a feint and back to the guard", () => {
    const runs = [["light", "lr", Infinity], ["heavy", "tb", Infinity], ["light", "stab", Infinity],
      ["heavy", "rl", Infinity], ["light", "rl", swingAt("light", "rl", 0).liveAt - 4]] as const;
    for (const [attack, way, cutAt] of runs) {
      const most = (perSec: number) => {
        const frames = swingRun(attack, way, perSec, cutAt);
        let turnRad = 0, handM = 0;
        for (let i = 1; i < frames.length; i++) {
          const a = frames[i - 1]!, b = frames[i]!;
          turnRad = Math.max(turnRad, Math.acos(Math.min(1, Vector3.Dot(a.way, b.way))));
          handM = Math.max(handM, Vector3.Distance(a.hand, b.hand));
        }
        return { turnRad, handM };
      };
      const at60 = most(60), at240 = most(240), at960 = most(960);
      const what = `${attack} ${way}${cutAt < Infinity ? " feinted" : ""}`;
      assert.ok(at960.turnRad < at240.turnRad / 3, `${what}: ${at240.turnRad} rad a frame at 240 fps, ${at960.turnRad} at 960`);
      assert.ok(at960.handM < at240.handM / 3, `${what}: ${at240.handM} m a frame at 240 fps, ${at960.handM} at 960`);
      assert.ok(at60.turnRad < 0.6 && at60.handM < 0.08, `${what}: ${at60.turnRad} rad, ${at60.handM} m a frame at 60`);
    }
  });
});

describe("first person: the blade stays in front of your head", () => {
  const scene = new Scene(new NullEngine()), sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;
  const node = new TransformNode("player", scene), feet = { x: 2, y: 0.7, z: -1 };
  node.position.set(feet.x, feet.y, feet.z);
  const model = buildPerson({ scene, sky }, 1, node, BUILD);
  model.holder.rotation.y = 0.4;
  const ctx = { scene, sky, bows: new Map() } as unknown as ArenaScene;
  const { view, seen } = viewFrom(0.4, CAMERA_VIEWS.fp.lockPitchRad, feet);
  const PER_SEC = 50;

  test("from any guard into any swing, chained into any other, back to any guard, either hand, light or heavy", () => {
    const held = [["longsword", "sword"], ["greatsword", null]] as const;
    for (const [weapon, offWeapon] of held) {
      for (const side of [1, -1] as const) {
        const grip = model.joints[side === 1 ? "grip.R" : "grip.L"], offGrip = model.joints[side === 1 ? "grip.L" : "grip.R"];
        const blade = holdBlade(ctx, 1 as Entity, grip, weapon, 0);
        const offBlade = offWeapon && holdBlade(ctx, 1 as Entity, offGrip, offWeapon, 0);
        const blades = [{ grip, lengthM: WEAPON_LOOKS[weapon].blade.lengthM },
          ...(offWeapon ? [{ grip: offGrip, lengthM: WEAPON_LOOKS[offWeapon].blade.lengthM }] : [])];
        for (const attack of ["light", "heavy"] as const) {
          const p: PersonDrawing = { ...newPerson(), model, look: DEFAULT_LOOK, bladeSide: side, blade, offBlade };
          let nearest = { depthM: Infinity, at: () => "" }, mostTurnRad = 0, lastWay: Vector3 | null = null;
          const frame = (swing: SwingData | null, alpha: number, way: Way, at: () => string) => {
            p.pose = personPose(playerDoing(swing ? "attack" : "none", 0, way === "stab" ? null : way), { swing },
              MOTIONS.sword, { ...moment, side, walk: still, alpha, guard: offWeapon ? "dual" : "one",
                twoHanded: WEAPON_LOOKS[weapon].twoHanded });
            restShoulders(p);
            holdInView(p, view, 1, 1 / PER_SEC);
            const bladeWay = Vector3.TransformNormal(Vector3.Up(), grip.getWorldMatrix()).normalize();
            if (lastWay) mostTurnRad = Math.max(mostTurnRad, Math.acos(Math.min(1, Vector3.Dot(bladeWay, lastWay))));
            lastWay = bladeWay;
            for (const b of blades) {
              const from = b.grip.getAbsolutePosition(), way = Vector3.TransformNormal(Vector3.Up(), b.grip.getWorldMatrix());
              for (let m = BLADE_FROM_M; m <= BLADE_FROM_M + b.lengthM + 1e-9; m += 0.1) {
                const { depthM } = seen(from.add(way.normalize().scale(m)));
                if (depthM < nearest.depthM) nearest = { depthM, at };
              }
            }
          };
          const guard = (way: Way, time: number) => {
            for (let i = 0; i < time * PER_SEC; i++) frame(null, 1, way, () => `guard ${way}`);
          };
          const swing = (way: Way, after: string) => {
            const s = swingAt(attack, way, 0);
            for (let i = 0; i < s.endAt * FIXED_DT * PER_SEC; i++) {
              const clock = i / PER_SEC / FIXED_DT, step = Math.floor(clock) + 1;
              s.step = step;
              frame(s, clock % 1, way, () => `${way} after ${after}, step ${step}`);
            }
          };
          for (const from of WAYS) {
            for (const to of WAYS) {
              guard(from, guardShiftTime(WEAPONS[weapon].heft));
              swing(to, `guard ${from}`);
              swing(from, `swing ${to}`);
              guard(to, FP_SWING.returnTime);
            }
          }
          // The eye is the camera's distance behind the head's middle.
          assert.ok(nearest.depthM > CAMERA_VIEWS.fp.distanceM,
            `${weapon} ${side} ${attack}: ${nearest.depthM} m ahead of the eye at ${nearest.at()}`);
          // Changing its way round mid-turn, the blade would jump by most of a half turn.
          assert.ok(mostTurnRad < 1.2, `${weapon} ${side} ${attack}: turned ${mostTurnRad} rad in a frame`);
        }
        blade.root.dispose();
        offBlade?.root.dispose();
      }
    }
  });
});

const cross = (a: Vec3, b: Vec3): Vec3 =>
  ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const MOST_LEAN_RAD = Math.max(...Object.values(GUARD_LEAN));

describe("first person: the guard", () => {
  const { forward, right, up } = POSED_FOR;
  const startIn = (way: SwingDir, r: Vec3, u: Vec3): Vec3 => {
    const { x, y } = SCREEN_DIR[way];
    return { x: -x * r.x - y * u.x, y: -x * r.y - y * u.y, z: -x * r.z - y * u.z };
  };

  test("aimed, the blade lies in the cut's plane through the view and its edge faces where you look, either hand", () => {
    for (const side of [1, -1] as const) {
      for (const way of SWING_DIRS) {
        const g = guardInView(way, side), plane = cross(forward, startIn(way, right, up)), what = `${side} ${way}`;
        assert.ok(Math.abs(dot(g.blade, plane)) < 1e-9 && Math.abs(dot(g.edge, plane)) < 1e-9, `${what}: in plane`);
        assert.ok(dot(g.blade, startIn(way, right, up)) > 0, `${what}: toward where the cut starts`);
        assert.ok(dot(g.edge, forward) >= Math.cos(MOST_LEAN_RAD) - 1e-9, `${what}: edge ${dot(g.edge, forward)}`);
      }
    }
  });

  test("each guard's hand is toward where its cut starts, in reach, the blade's foot in view, the crosshair clear", () => {
    const lengthM = WEAPON_LOOKS.sword.blade.lengthM, unit = (v: Vec3) => {
      const l = Math.hypot(v.x, v.y, v.z);
      return { x: v.x / l, y: v.y / l, z: v.z / l };
    };
    for (const side of [1, -1] as const) {
      const spots = SWING_DIRS.map((way) => onScreen(guardInView(way, side).hand));
      const mean = { x: spots.reduce((s, p) => s + p.x, 0) / 7, y: spots.reduce((s, p) => s + p.y, 0) / 7 };
      SWING_DIRS.forEach((way, i) => {
        const g = guardInView(way, side), s = spots[i]!, what = `${side} ${way}`, { x, y } = SCREEN_DIR[way];
        assert.ok(-(s.x - mean.x) * x - (s.y - mean.y) * y > 0.12, `${what}: the hand at ${s.x}, ${s.y}`);
        assertInView(g.hand, `${what}: the hand`);
        assertInView(along(g.hand, g.blade, BLADE_FROM_M), `${what}: the blade's foot`);
        assertInReach(g.hand, side, what);
        const offM = Math.abs(dot(unit(cross(forward, startIn(way, right, up))), sub(g.hand, POSED_FOR.eye)));
        assert.ok(offM > 0.07, `${what}: the cut's plane ${offM} m from the eye, the blade a line`);
        for (let m = BLADE_FROM_M; m <= BLADE_FROM_M + lengthM; m += 0.05) {
          const at = onScreen(along(g.hand, g.blade, m));
          if (at.depthM > 0.1) assert.ok(Math.hypot(at.x, at.y) > CLEAR, `${what}: over the crosshair at ${m} m`);
        }
      });
    }
  });

  test("drawn, the sword's flat turns as the guard holds it, wherever the camera looks", () => {
    const scene = new Scene(new NullEngine()), sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;
    const node = new TransformNode("player", scene), feet = { x: 2, y: 0.7, z: -1 };
    node.position.set(feet.x, feet.y, feet.z);
    const model = buildPerson({ scene, sky }, 1, node, BUILD);
    model.holder.rotation.y = 0.4;
    const ctx = { scene, sky, bows: new Map() } as unknown as ArenaScene;
    for (const side of [1, -1] as const) {
      const grip = model.joints[side === 1 ? "grip.R" : "grip.L"];
      const blade = holdBlade(ctx, 1 as Entity, grip, "sword", 0);
      const person: PersonDrawing = { ...newPerson(), model, look: DEFAULT_LOOK, bladeSide: side, blade };
      for (const [yaw, pitch] of [[0.4, CAMERA_VIEWS.fp.lockPitchRad], [1.5, -0.6]] as const) {
        const { view, forward: ahead } = viewFrom(yaw, pitch, feet), r = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
        const u = cross(ahead, r);
        for (const way of SWING_DIRS) {
          person.pose = swordPose(playerDoing("none", 1, way), null, side);
          person.inView = null;
          restShoulders(person);
          holdInView(person, view, 1, 0);
          const m = grip.getWorldMatrix(), what = `${side} ${way} at ${yaw}, ${pitch}`;
          const b = Vector3.TransformNormal(Vector3.Up(), m).normalize(), e = Vector3.TransformNormal(Vector3.Right(), m)
            .normalize(), plane = cross(ahead, startIn(way, r, u));
          const off = Math.abs(dot(b, plane)) / Math.hypot(plane.x, plane.y, plane.z);
          assert.ok(off < 0.01, `${what}: the blade ${off} out of the cut's plane`);
          assert.ok(dot(e, ahead) >= Math.cos(MOST_LEAN_RAD) - 0.01, `${what}: the edge ${dot(e, ahead)} ahead`);
        }
      }
      blade.root.dispose();
    }
    scene.dispose();
  });
});

describe("first person: the block reads", () => {
  const blocking = (guard: GuardKind, side: 1 | -1 = 1) => personPose(playerDoing("block", 1, "rl"), { swing: null },
    MOTIONS.sword, { ...moment, side, walk: still, guard });
  const flat = (held: { blade: Vec3; edge: Vec3 }) => cross(held.edge, held.blade);
  const lengthM = WEAPON_LOOKS.sword.blade.lengthM;

  test("one blade: across the view below the crosshair, the other hand under it, both hands in view", () => {
    for (const side of [1, -1] as const) {
      const p = blocking("one", side), foot = onScreen(along(p.hand, p.blade, BLADE_FROM_M));
      const mid = onScreen(along(p.hand, p.blade, BLADE_FROM_M + lengthM / 2));
      assert.ok(Math.abs(mid.y - foot.y) < 0.4 * Math.abs(mid.x - foot.x) && (mid.x - foot.x) * side < -0.5,
        `${side}: from ${foot.x}, ${foot.y} to ${mid.x}, ${mid.y}`);
      for (let m = BLADE_FROM_M; m <= BLADE_FROM_M + lengthM / 2; m += 0.05) {
        assert.ok(onScreen(along(p.hand, p.blade, m)).y < -0.15, `${side}: below the crosshair at ${m} m`);
      }
      assertInView(p.hand, `${side}: the sword hand`);
      assertInView(p.offHand, `${side}: the other hand`);
    }
  });

  test("two blades: an X crossed below the crosshair, their points spreading out either side of it", () => {
    for (const side of [1, -1] as const) {
      const p = blocking("dual", side), off = p.off!;
      const a0 = onScreen(along(p.hand, p.blade, BLADE_FROM_M)), a1 = onScreen(along(p.hand, p.blade, 0.8));
      const b0 = onScreen(along(p.offHand, off.blade, BLADE_FROM_M)), b1 = onScreen(along(p.offHand, off.blade, 0.8));
      const dx = (a1.x - a0.x) * (b1.y - b0.y) - (a1.y - a0.y) * (b1.x - b0.x);
      const t = ((b0.x - a0.x) * (b1.y - b0.y) - (b0.y - a0.y) * (b1.x - b0.x)) / dx;
      const s = ((b0.x - a0.x) * (a1.y - a0.y) - (b0.y - a0.y) * (a1.x - a0.x)) / dx;
      const crossAt = { x: a0.x + (a1.x - a0.x) * t, y: a0.y + (a1.y - a0.y) * t };
      assert.ok(t > 0 && t < 1 && s > 0 && s < 1, `${side}: the blades cross on screen (${t}, ${s})`);
      assert.ok(crossAt.y < -0.1 && Math.abs(crossAt.x) < 0.15, `${side}: crossed at ${crossAt.x}, ${crossAt.y}`);
      assert.ok(a1.x * side < -0.2 && b1.x * side > 0.2, `${side}: points out at ${a1.x} and ${b1.x}`);
      assertInView(p.hand, `${side}: the sword hand`);
      assertInView(p.offHand, `${side}: the other hand`);
    }
  });

  test("a shield: raised before you facing ahead, filling the bottom of the view up to just under the crosshair", () => {
    for (const side of [1, -1] as const) {
      const p = blocking("shield", side), face = flat(p.off!), middle = along(p.offHand, face, SHIELD.standM);
      assert.ok(dot(face, POSED_FOR.forward) > 0.9, `${side}: facing ahead`);
      const top = onScreen(along(middle, p.off!.blade, SHIELD.radiusM)), at = onScreen(middle);
      assert.ok(top.y < -0.03 && top.y > -0.3, `${side}: the rim at ${top.y}`);
      assert.ok(Math.abs(at.x) < 0.45 && at.y < -0.35, `${side}: in the middle at ${at.x}, ${at.y}`);
      assertInView(p.offHand, `${side}: the shield hand`);
    }
  });
});

describe("first person: changing guard or blocking eases, the edge kept toward the foe", () => {
  const scene = new Scene(new NullEngine()), sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;
  const node = new TransformNode("player", scene), feet = { x: 2, y: 0.7, z: -1 };
  node.position.set(feet.x, feet.y, feet.z);
  const model = buildPerson({ scene, sky }, 1, node, BUILD);
  model.holder.rotation.y = 0.4;
  const ctx = { scene, sky, bows: new Map() } as unknown as ArenaScene;
  const { view, forward } = viewFrom(0.4, CAMERA_VIEWS.fp.lockPitchRad, feet);
  const upward = cross(forward, { x: Math.cos(0.4), y: 0, z: -Math.sin(0.4) });
  const grip = model.joints["grip.R"];

  type Moment = { action: PlayerAction; way: SwingDir; guard?: GuardKind };
  function run(weapon: WeaponId, perSec: number, endTime: number, at: (t: number) => Moment) {
    const blade = holdBlade(ctx, 1 as Entity, grip, weapon, 0), twoHanded = WEAPON_LOOKS[weapon].twoHanded;
    const p: PersonDrawing = { ...newPerson(), model, look: DEFAULT_LOOK, bladeSide: 1, blade };
    const frames = [];
    for (let i = 0; i <= endTime * perSec; i++) {
      const t = i / perSec, m = at(t);
      p.pose = personPose(playerDoing(m.action, 1, m.way), { swing: null }, MOTIONS.sword,
        { ...moment, side: 1, walk: still, guard: m.guard ?? "one", twoHanded });
      restShoulders(p);
      holdInView(p, view, 1, 1 / perSec);
      const w = grip.getWorldMatrix(), offGrip = model.joints["grip.L"];
      frames.push({ t, hand: grip.getAbsolutePosition().clone(), blade: Vector3.TransformNormal(Vector3.Up(), w)
        .normalize(), edge: Vector3.TransformNormal(Vector3.Right(), w).normalize(),
        offHand: offGrip.getAbsolutePosition().clone(),
        offBlade: Vector3.TransformNormal(Vector3.Up(), offGrip.getWorldMatrix()).normalize() });
    }
    blade.root.dispose();
    return frames;
  }
  const angleRad = (a: Vector3, b: Vector3) => Math.acos(Math.min(1, Vector3.Dot(a, b)));
  const CHANGE_TIME = 0.3;

  test("the shift takes about a tenth of a second, longer for a heavier weapon", () => {
    assert.equal(guardShiftTime(WEAPONS.sword.heft), GUARD_SHIFT.time);
    const great = guardShiftTime(WEAPONS.greatsword.heft);
    assert.ok(great > GUARD_SHIFT.time + 0.03 && great < 2 * GUARD_SHIFT.time, `${great}`);
  });

  test("left to right, the blade swings over the top over the shift's time, its edge toward the foe all the way", () => {
    for (const weapon of ["sword", "greatsword"] as const) {
      const shiftTime = guardShiftTime(WEAPONS[weapon].heft);
      const frames = run(weapon, 240, CHANGE_TIME + 0.4, (t) => ({ action: "none", way: t < CHANGE_TIME ? "lr" : "rl" }));
      const from = frames.filter((f) => f.t < CHANGE_TIME).at(-1)!, to = frames.at(-1)!;
      const half = frames.find((f) => f.t >= CHANGE_TIME + shiftTime / 2)!;
      assert.ok(angleRad(half.blade, from.blade) > 0.4 && angleRad(half.blade, to.blade) > 0.4, `${weapon}: eased`);
      const done = frames.find((f) => f.t >= CHANGE_TIME + shiftTime + 0.01)!;
      assert.ok(angleRad(done.blade, to.blade) < 0.03, `${weapon}: there after ${shiftTime} s`);
      const shifting = frames.filter((f) => f.t >= CHANGE_TIME && f.t <= CHANGE_TIME + shiftTime);
      assert.ok(Math.max(...shifting.map((f) => dot(f.blade, upward))) > 0.6, `${weapon}: over the top`);
      for (const f of frames) assert.ok(dot(f.edge, forward) > 0.5, `${weapon} at ${f.t}: the edge ${dot(f.edge, forward)}`);
    }
  });

  test("raising and lowering the block eases, nothing jumps, whatever blocks", () => {
    for (const guard of ["one", "dual", "shield"] as const) {
      const script = (t: number): Moment => ({ action: t >= CHANGE_TIME && t < 2 * CHANGE_TIME ? "block" : "none",
        way: "rl", guard });
      const most = (perSec: number) => {
        const frames = run("sword", perSec, 3 * CHANGE_TIME, script);
        let turnRad = 0, handM = 0;
        for (let i = 1; i < frames.length; i++) {
          const a = frames[i - 1]!, b = frames[i]!;
          turnRad = Math.max(turnRad, angleRad(b.blade, a.blade), angleRad(b.offBlade, a.offBlade));
          handM = Math.max(handM, Vector3.Distance(b.hand, a.hand), Vector3.Distance(b.offHand, a.offHand));
        }
        for (const f of frames) assert.ok(dot(f.edge, forward) > 0.3, `${guard} at ${f.t}: the edge ${dot(f.edge, forward)}`);
        return { turnRad, handM };
      };
      const at60 = most(60), at240 = most(240);
      assert.ok(at240.turnRad < at60.turnRad / 2.5 + 1e-6, `${guard}: ${at60.turnRad} rad a frame at 60, ${at240.turnRad} at 240`);
      assert.ok(at240.handM < at60.handM / 2.5 + 1e-6, `${guard}: ${at60.handM} m a frame at 60, ${at240.handM} at 240`);
    }
  });
});

describe("first person: leaving it", () => {
  test("the arms are in first person while the eye is in the head, back on the body before the body shows", () => {
    const fp = CAMERA_VIEWS.fp, me = { x: 1, y: 0.7, z: 2 }, eye = (m: number) => ({ x: 1, y: 0.7 + fp.orbitHeightM, z: 2 - m });
    assert.equal(fpShare(eye(fp.distanceM), me), 1);
    assert.equal(fpShare(eye(0), me), 1);
    let last = 1;
    for (let m = fp.distanceM; m < 3; m += 0.01) {
      const share = fpShare(eye(m), me);
      assert.ok(share <= last && last - share < 0.05, `${m} m: ${share} after ${last}`);
      if (share > 0) assert.ok(insideSelf(eye(m), me), `${m} m: the body shows while the arms are ${share} in view`);
      last = share;
    }
    assert.equal(fpShare(eye(FP_ARMS.fade.goneM), me), 0);
  });

  test("as the share falls the hands glide from first person to where the body holds them", () => {
    const scene = new Scene(new NullEngine()), sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;
    const node = new TransformNode("player", scene), feet = { x: 2, y: 0.7, z: -1 };
    node.position.set(feet.x, feet.y, feet.z);
    const model = buildPerson({ scene, sky }, 1, node, BUILD);
    model.holder.rotation.y = 0.4;
    const pose = swordPose(), person: PersonDrawing = { ...newPerson(), model, look: DEFAULT_LOOK, bladeSide: 1, pose };
    const bladeTurn = Quaternion.FromUnitVectorsToRef(Vector3.Up(), new Vector3(pose.blade.x, pose.blade.y,
      pose.blade.z), Quaternion.Identity());
    const { view } = viewFrom(0.4, CAMERA_VIEWS.fp.lockPitchRad, feet);
    const handAt = (share: number) => {
      restShoulders(person);
      reachArms(model.joints, BUILD.look.body, 1, pose.hand, bladeTurn,
        { hand: pose.offHand, holding: Quaternion.Identity(), held: null }, WEAPON_LOOKS.sword);
      const body = model.joints["hand.R"].getAbsolutePosition().clone();
      if (share > 0) holdInView(person, view, share, 0);
      return { body, shown: model.joints["hand.R"].getAbsolutePosition().clone() };
    };
    let last = handAt(1).shown;
    for (let share = 0.98; share >= 0; share -= 0.02) {
      const { shown } = handAt(share);
      assert.ok(Vector3.Distance(shown, last) < 0.03, `at ${share}: ${Vector3.Distance(shown, last)} m`);
      last = shown;
    }
    const { body, shown } = handAt(0.001);
    assert.ok(Vector3.Distance(body, shown) < 0.005, `${Vector3.Distance(body, shown)} m off the body's`);
    scene.dispose();
  });
});
