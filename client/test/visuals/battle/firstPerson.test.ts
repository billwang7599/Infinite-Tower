import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, TransformNode, Vector3, type AbstractMesh } from "@babylonjs/core";
import {
  DEFAULT_LOOK, FIXED_DT, SCREEN_DIR, type Entity, type SwingData, type SwingDir, type Vec3, type Way,
} from "@infinite-tower/shared";
import { CAMERA_VIEWS, insideSelf } from "../../../src/modes/battle/camera.js";
import { orbitBack } from "../../../src/modes/orbit.js";
import { BLADE_FROM_M, holdBlade } from "../../../src/visuals/battle/blade.js";
import { ARROW_M, pullString } from "../../../src/visuals/battle/bow.js";
import { moveBow, restingBow, type BowDraw, type BowMotion } from "../../../src/visuals/battle/bowMotion.js";
import {
  bowInView, FP_ARMS, FP_BOW, firstPersonArms, fpShare, holdInView, POSED_FOR, restShoulders, swungInView,
} from "../../../src/visuals/battle/firstPerson.js";
import type { ArenaScene } from "../../../src/visuals/battle/scene.js";
import {
  newPerson, OFF_GRIP_M, reachArms, type PersonDrawing,
} from "../../../src/visuals/battle/person/animation.js";
import { buildPerson, personBuild } from "../../../src/visuals/battle/person/model.js";
import type { Sky } from "../../../src/visuals/sky/sky.js";
import { personPose, type PersonPose } from "../../../src/visuals/battle/person/pose.js";
import { restInModel } from "../../../src/visuals/battle/person/skeleton.js";
import { MOTIONS, WEAPON_LOOKS } from "../../../src/visuals/battle/weapons.js";
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
      holdInView(person, view, false, 1, 0);
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
    holdInView(person, view, false, 1, 0);
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
    holdInView(p, view, false, 1, dt);
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
      reachArms(model.joints, BUILD.look.body, 1, new Vector3(pose.hand.x, pose.hand.y, pose.hand.z), bladeTurn,
        pose.offHand, WEAPON_LOOKS.sword);
      const body = model.joints["hand.R"].getAbsolutePosition().clone();
      if (share > 0) holdInView(person, view, false, share, 0);
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
