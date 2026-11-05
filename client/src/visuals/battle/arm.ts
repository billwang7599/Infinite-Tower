import {
  Matrix, MeshBuilder, Quaternion, TransformNode, Vector3, type Mesh, type Scene, type StandardMaterial,
} from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";
import { sectionAt, type Section } from "./person/loft.js";

export interface ArmBones { upperM: number; foreM: number }

const unit = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

export function reachArm(shoulder: Vec3, target: Vec3, bones: ArmBones, pole: Vec3): { elbow: Vec3; hand: Vec3 } {
  const { upperM: a, foreM: b } = bones;
  const dx = target.x - shoulder.x, dy = target.y - shoulder.y, dz = target.z - shoulder.z;
  const toTarget = Math.hypot(dx, dy, dz);
  const axis = toTarget > 1e-9 ? { x: dx / toTarget, y: dy / toTarget, z: dz / toTarget } : { x: 0, y: 0, z: 1 };
  const d = Math.min(a + b, Math.max(Math.abs(a - b), 1e-4, toTarget));
  const along = (a * a - b * b + d * d) / (2 * d), out = Math.sqrt(Math.max(0, a * a - along * along));
  const p = pole.x * axis.x + pole.y * axis.y + pole.z * axis.z;
  let bend = { x: pole.x - axis.x * p, y: pole.y - axis.y * p, z: pole.z - axis.z * p };
  if (Math.hypot(bend.x, bend.y, bend.z) < 1e-6) bend = { x: -axis.z, y: 0, z: axis.x };
  if (Math.hypot(bend.x, bend.y, bend.z) < 1e-6) bend = { x: 1, y: 0, z: 0 };
  bend = unit(bend.x, bend.y, bend.z);
  return {
    elbow: {
      x: shoulder.x + axis.x * along + bend.x * out,
      y: shoulder.y + axis.y * along + bend.y * out,
      z: shoulder.z + axis.z * along + bend.z * out,
    },
    hand: { x: shoulder.x + axis.x * d, y: shoulder.y + axis.y * d, z: shoulder.z + axis.z * d },
  };
}

/** Sections in metres, in `node`'s frame. */
export interface BodyPart { node: TransformNode; sections: readonly Section[]; roundness: number }

/** `upperFrom`: the share of the upper arm, from the shoulder, that is its joint and may sink in. */
export interface Clearance {
  body: readonly BodyPart[];
  upperM: number;
  foreM: number;
  handM: number;
  upperFrom: number;
}

/** Along the hand's +y. */
export interface BladeReach { fromM: number; toM: number; halfM: number }

/** Past the limb's own thickness. */
const CLEAR_M = 0.012;
const SWIVEL_STEP_RAD = Math.PI / 12;
const ARM_SAMPLES = 4;
const BLADE_STEP_M = 0.05;
/** Of the arm's length, ahead of the shoulder: where a hand goes that can't get round the body. */
const SAFE_REACH = 0.7;
const SAFE_SEARCH_STEPS = 10;

const toPart: Matrix[] = [];
const local = new Vector3(), shoulderAt = new Vector3(), targetAt = new Vector3(), poleAt = new Vector3();
const bentPole = new Vector3(), turnedPole = new Vector3(), elbowAt = new Vector3(), along = new Vector3();
const axis = new Vector3(), swivel = new Quaternion(), bladeWay = new Vector3(), onBlade = new Vector3();
const handIn = new Vector3(), wayIn = new Vector3(), moved = new Vector3(), goal = new Vector3();
const safe = new Vector3();
let deepestPart = 0;

function inBody(c: Clearance, at: Vector3, growM: number, out = false): number {
  let deepest = 0;
  c.body.forEach(({ node, sections, roundness: r }, i) => {
    Vector3.TransformCoordinatesToRef(at, toPart[i]!, local);
    if (local.y < sections[0]!.y || local.y > sections.at(-1)!.y) return;
    const s = sectionAt(sections, local.y), x = local.x - (s.dx ?? 0), z = local.z - (s.dz ?? 0);
    const w = s.x + growM, d = s.z + growM, size = ((Math.abs(x) / w) ** r + (Math.abs(z) / d) ** r) ** (1 / r);
    if (size >= 1) return;
    const off = Math.hypot(x, z), depth = off < 1e-9 ? Math.min(w, d) : off * (1 / size - 1);
    if (depth > deepest) deepestPart = i;
    deepest = Math.max(deepest, depth);
    if (!out) return;
    const [ox, oz] = off < 1e-9 ? [0, d] : [x / size, z / size];
    local.set((s.dx ?? 0) + ox, local.y, (s.dz ?? 0) + oz);
    Vector3.TransformCoordinatesToRef(local, node.getWorldMatrix(), at);
  });
  return deepest;
}

const reachOf = (bones: ArmBones) => bones.upperM + bones.foreM;

function clearBlade(c: Clearance, bones: ArmBones, blade: BladeReach): void {
  for (let pass = 0; pass < c.body.length; pass++) {
    let deepest = 0, part = 0, deepY = 0;
    for (let t = blade.fromM; t <= blade.toM + 1e-9; t += BLADE_STEP_M) {
      bladeWay.scaleToRef(t, onBlade).addInPlace(targetAt);
      const depth = inBody(c, onBlade, blade.halfM + CLEAR_M);
      if (depth <= deepest) continue;
      deepest = depth;
      part = deepestPart;
      deepY = Vector3.TransformCoordinatesToRef(onBlade, toPart[part]!, local).y;
    }
    if (!deepest) return;
    const { node, sections, roundness } = c.body[part]!;
    Vector3.TransformCoordinatesToRef(targetAt, toPart[part]!, handIn);
    Vector3.TransformNormalToRef(bladeWay, toPart[part]!, wayIn);
    const s = sectionAt(sections, deepY), grow = blade.halfM + CLEAR_M, w = s.x + grow, d = s.z + grow;
    const cx = s.dx ?? 0, cz = s.dz ?? 0, flat = Math.hypot(wayIn.x, wayIn.z);
    let nx = flat > 0.2 ? wayIn.z / flat : handIn.x - cx, nz = flat > 0.2 ? -wayIn.x / flat : handIn.z - cz;
    const n = Math.hypot(nx, nz) || 1;
    nx /= n;
    nz /= n;
    const q = roundness / (roundness - 1), wide = (Math.abs(w * nx) ** q + Math.abs(d * nz) ** q) ** (1 / q);
    const off = (handIn.x - cx) * nx + (handIn.z - cz) * nz;
    const reaches = (by: number) => {
      moved.set(handIn.x + nx * by, handIn.y, handIn.z + nz * by);
      return Vector3.Distance(Vector3.TransformCoordinatesToRef(moved, node.getWorldMatrix(), moved), shoulderAt)
        <= reachOf(bones);
    };
    const ways = [wide - off, -wide - off].sort((a, b) => Math.abs(a) - Math.abs(b));
    const by = ways.find(reaches) ?? ways[0]!;
    handIn.set(handIn.x + nx * by, handIn.y, handIn.z + nz * by);
    Vector3.TransformCoordinatesToRef(handIn, node.getWorldMatrix(), targetAt);
  }
}

function armInBody(c: Clearance, bones: ArmBones, pole: Vector3, most: number): number {
  const { elbow, hand } = reachArm(shoulderAt, targetAt, bones, pole);
  elbowAt.set(elbow.x, elbow.y, elbow.z);
  let deepest = 0;
  for (let k = 0; k <= ARM_SAMPLES && deepest < most; k++) {
    const t = k / ARM_SAMPLES;
    Vector3.LerpToRef(shoulderAt, elbowAt, c.upperFrom + (1 - c.upperFrom) * t, along);
    deepest = Math.max(deepest, inBody(c, along, c.upperM + CLEAR_M));
    along.set(elbow.x + (hand.x - elbow.x) * t, elbow.y + (hand.y - elbow.y) * t, elbow.z + (hand.z - elbow.z) * t);
    deepest = Math.max(deepest, inBody(c, along, c.foreM + CLEAR_M));
  }
  return deepest;
}

function clearPole(c: Clearance, bones: ArmBones): number {
  targetAt.subtractToRef(shoulderAt, axis).normalize();
  const turned = (rad: number, most = Infinity) => {
    Quaternion.RotationAxisToRef(axis, rad, swivel);
    poleAt.applyRotationQuaternionToRef(swivel, turnedPole);
    return armInBody(c, bones, turnedPole, most);
  };
  let best = 0, least = turned(0);
  for (let k = 1; least > 0 && k <= Math.PI / SWIVEL_STEP_RAD; k++) {
    for (const rad of [k * SWIVEL_STEP_RAD, -k * SWIVEL_STEP_RAD]) {
      const depth = turned(rad, least);
      if (depth >= least) continue;
      least = depth;
      best = rad;
      if (depth > 0) continue;
      // Between the last step that clipped and this one, so the elbow moves smoothly as the pose does.
      let inside = rad - Math.sign(rad) * SWIVEL_STEP_RAD;
      for (let i = 0; i < 5; i++) {
        const mid = (inside + best) / 2;
        if (turned(mid, 1e-9) > 0) inside = mid;
        else best = mid;
      }
      break;
    }
  }
  Quaternion.RotationAxisToRef(axis, best, swivel);
  poleAt.applyRotationQuaternionToRef(swivel, bentPole);
  return least;
}

function clearTarget(c: Clearance, bones: ArmBones, blade: BladeReach | null): number {
  for (let i = 0; i < c.body.length; i++) inBody(c, targetAt, c.handM + CLEAR_M, true);
  if (blade) clearBlade(c, bones, blade);
  return clearPole(c, bones);
}

export function reachRound(
  shoulder: Vector3, target: Vector3, bones: ArmBones, pole: Vector3, c: Clearance, ahead: Vector3,
  blade: (BladeReach & { way: Vector3 }) | null = null,
): { elbow: Vec3; hand: Vec3 } {
  c.body.forEach((p, i) => p.node.getWorldMatrix().invertToRef((toPart[i] ??= new Matrix())));
  shoulderAt.copyFrom(shoulder);
  targetAt.copyFrom(target);
  poleAt.copyFrom(pole);
  if (blade) bladeWay.copyFrom(blade.way);
  if (clearTarget(c, bones, blade) > 0) {
    goal.copyFrom(targetAt);
    ahead.normalizeToRef(safe).scaleInPlace(reachOf(bones) * SAFE_REACH).addInPlace(shoulderAt);
    let near = 0, far = 1;
    for (let i = 0; i < SAFE_SEARCH_STEPS; i++) {
      const mid = (near + far) / 2;
      Vector3.LerpToRef(goal, safe, mid, targetAt);
      if (clearTarget(c, bones, blade) > 0) near = mid;
      else far = mid;
    }
    Vector3.LerpToRef(goal, safe, far, targetAt);
    clearTarget(c, bones, blade);
  }
  return reachArm(shoulderAt, targetAt, bones, bentPole);
}

type Part = (mesh: Mesh, under: TransformNode, material: StandardMaterial) => Mesh;
const FIST_SHARE = 1.15;

export interface ArmLook {
  /** 1: the right arm. */
  side: 1 | -1;
  /** In the chest's frame (or the model's, with no chest). */
  shoulder: Vec3;
  reachM: number;
  thicknessM: number;
  upper: StandardMaterial;
  fore: StandardMaterial;
  fist: StandardMaterial;
  /** `jointShare`: of the upper arm from the shoulder, sunk in the body as its joint. */
  body?: { parts: readonly BodyPart[]; jointShare: number };
}

/** Its meshes hang under the model; `hand` is where a held thing goes, its +y along what it holds. */
export interface Arm {
  bones: ArmBones;
  shoulder: Vector3;
  model: TransformNode;
  chest: TransformNode | null;
  pole: Vec3;
  clearance: Clearance | null;
  upper: Mesh;
  fore: Mesh;
  elbow: Mesh;
  hand: TransformNode;
}

export function buildArm(
  scene: Scene, part: Part, model: TransformNode, chest: TransformNode | null, look: ArmLook,
): Arm {
  const bones = { upperM: look.reachM / 2, foreM: look.reachM / 2 }, t = look.thicknessM;
  const upper = part(MeshBuilder.CreateCylinder("arm-upper", {
    height: bones.upperM, diameterTop: t, diameterBottom: t * 0.85, tessellation: 8,
  }, scene), model, look.upper);
  const fore = part(MeshBuilder.CreateCylinder("arm-fore", {
    height: bones.foreM, diameterTop: t * 0.85, diameterBottom: t * 0.7, tessellation: 8,
  }, scene), model, look.fore);
  const elbow = part(MeshBuilder.CreateSphere("arm-elbow", { diameter: t * 0.9, segments: 6 }, scene), model,
    look.upper);
  const hand = new TransformNode("arm-hand", scene);
  hand.parent = model;
  part(MeshBuilder.CreateSphere("arm-fist", { diameter: t * FIST_SHARE, segments: 6 }, scene), hand, look.fist);
  const clearance: Clearance | null = look.body ? {
    body: look.body.parts, upperM: t / 2, foreM: (t * 0.85) / 2, handM: (t * FIST_SHARE) / 2,
    upperFrom: look.body.jointShare,
  } : null;
  return {
    bones, model, chest, upper, fore, elbow, hand, clearance,
    shoulder: new Vector3(look.shoulder.x, look.shoulder.y, look.shoulder.z),
    pole: unit(look.side * 0.5, -0.8, -0.45),
  };
}

const chestTurn = new Matrix(), shoulderIn = new Vector3(), up = new Vector3(0, 1, 0), dir = new Vector3();
const fromWorld = new Matrix(), worldShoulder = new Vector3(), worldTarget = new Vector3(), worldPole = new Vector3();
const ahead = new Vector3(), worldBlade = new Vector3();

export function placeBetween(bone: Mesh, from: Vec3, to: Vec3): void {
  bone.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  dir.set(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
  bone.rotationQuaternion ??= new Quaternion();
  Quaternion.FromUnitVectorsToRef(up, dir, bone.rotationQuaternion);
}

/** Forced from the top: a parent's cached matrix may predate this frame's turns. */
function freshWorld(node: TransformNode): Matrix {
  if (node.parent instanceof TransformNode) freshWorld(node.parent);
  return node.computeWorldMatrix(true);
}

function reachRoundIn(arm: Arm, c: Clearance, target: Vec3, blade: BladeReach | null): { elbow: Vec3; hand: Vec3 } {
  const toWorld = freshWorld(arm.model);
  for (const p of c.body) p.node.computeWorldMatrix(true);
  Vector3.TransformCoordinatesToRef(shoulderIn, toWorld, worldShoulder);
  Vector3.TransformCoordinatesToRef(worldTarget.set(target.x, target.y, target.z), toWorld, worldTarget);
  Vector3.TransformNormalToRef(worldPole.set(arm.pole.x, arm.pole.y, arm.pole.z), toWorld, worldPole);
  Vector3.TransformNormalToRef(Vector3.Forward(), (arm.chest ?? arm.model).getWorldMatrix(), ahead);
  if (blade) {
    up.applyRotationQuaternionToRef(arm.hand.rotationQuaternion ?? Quaternion.Identity(), worldBlade);
    Vector3.TransformNormalToRef(worldBlade, toWorld, worldBlade);
  }
  const { elbow, hand } = reachRound(worldShoulder, worldTarget, arm.bones, worldPole, c, ahead,
    blade && { ...blade, way: worldBlade });
  toWorld.invertToRef(fromWorld);
  const back = (v: Vec3) => Vector3.TransformCoordinates(new Vector3(v.x, v.y, v.z), fromWorld);
  return { elbow: back(elbow), hand: back(hand) };
}

/** `target` is in the model's frame; out of reach, the hand stops at arm's length. Turn the hand before. */
export function poseArm(arm: Arm, target: Vec3, blade: BladeReach | null = null): void {
  if (arm.chest) {
    const { rotation, position } = arm.chest;
    Matrix.RotationYawPitchRollToRef(rotation.y, rotation.x, rotation.z, chestTurn);
    Vector3.TransformCoordinatesToRef(arm.shoulder, chestTurn, shoulderIn).addInPlace(position);
  } else {
    shoulderIn.copyFrom(arm.shoulder);
  }
  const { elbow, hand } = arm.clearance ? reachRoundIn(arm, arm.clearance, target, blade)
    : reachArm(shoulderIn, target, arm.bones, arm.pole);
  placeBetween(arm.upper, shoulderIn, elbow);
  placeBetween(arm.fore, elbow, hand);
  arm.elbow.position.set(elbow.x, elbow.y, elbow.z);
  arm.hand.position.set(hand.x, hand.y, hand.z);
}
