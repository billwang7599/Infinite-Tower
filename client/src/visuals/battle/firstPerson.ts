import { Matrix, Quaternion, TransformNode, Vector3 } from "@babylonjs/core";
import { mirrorWay, PLAYER, smoothstep, type SwingData, type SwingDir, type Vec3 } from "@infinite-tower/shared";
import { CAMERA_VIEWS, type ArenaView } from "../../modes/battle/camera.js";
import { orbitBack } from "../../modes/orbit.js";
import { holdingOf } from "./blade.js";
import { ARROW_REST } from "./bow.js";
import type { BowMotion } from "./bowMotion.js";
import {
  ARM_POLE, bladeReach, easeArms, heldKey, OFF_GRIP_M, reachWith, shiftTimeOf, type HeldArms, type PersonDrawing,
} from "./person/animation.js";
import { swingArc } from "./person/pose.js";
import { restAt } from "./person/skeleton.js";
import { edgeToward, MOTIONS, wayCut, WEAPON_LOOKS, type BowLook, type WeaponLook } from "./weapons.js";

export interface Arms { hand: Vec3; blade: Vec3; offHand: Vec3 }

// Screen spots (shares of the half-height from the middle, for the right hand; mirrored for the left) the hands are
// pulled toward, `depthM` ahead of the eye; the blade leans toward `blade` (x right, y up, z ahead). With the eye
// `fade.fullM` from your own eyes the arms are all first person's, by `goneM` all the body's.
export const FP_ARMS = {
  hand: { x: 0.12, y: -0.6, depthM: 0.7 }, offHand: { x: -0.32, y: -0.62, depthM: 0.7 },
  blade: { x: -0.15, y: 0.6, z: 1 }, handPull: 0.6, offHandPull: 0.8, bladePull: 0.6, pole: { x: 0.5, y: -0.8, z: -0.2 },
  fade: { fullM: 0.5, goneM: 1.1 },
} as const;

// As FP_ARMS' spots, for the right hand; each off the line through the middle its way, so the flat shows a little.
export const FP_GUARD = {
  depthM: 0.6,
  hand: {
    tb: { x: 0.26, y: -0.2 }, trbl: { x: 0.52, y: -0.3 }, rl: { x: 0.6, y: -0.5 }, brtl: { x: 0.6, y: -0.32 },
    bltr: { x: -0.15, y: -0.5 }, lr: { x: -0.12, y: -0.46 }, tlbr: { x: -0.06, y: -0.3 },
  } satisfies Record<SwingDir, { x: number; y: number }>,
} as const;

export const FP_SWING = {
  hand: { x: 0.08, y: -0.4, depthM: 0.62 }, sweepM: 0.08, pushM: 0.08, stabPushM: 0.12, aimDepthM: 1.6,
  backRad: 0.6, heavyBackRad: 0.9, overRad: 0.7, outShare: 0.35, sideRad: 0.3,
  returnTime: 0.2,
} as const;

const fp = CAMERA_VIEWS.fp, back = orbitBack(0, fp.lockPitchRad);
/** The first-person view the arms are posed for, in the model's frame (feet at 0, +z ahead). */
export const POSED_FOR = {
  eye: { x: 0, y: PLAYER.height / 2 + fp.orbitHeightM + back.y * fp.distanceM, z: back.z * fp.distanceM },
  right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: -back.z, z: back.y }, forward: { x: -back.x, y: -back.y, z: -back.z },
} as const;

export function fpShare(eye: Vec3, me: Vec3): number {
  const m = Math.hypot(eye.x - me.x, eye.y - me.y - fp.orbitHeightM, eye.z - me.z);
  return 1 - smoothstep(FP_ARMS.fade.fullM, FP_ARMS.fade.goneM, m);
}

const fromCamera = (x: number, y: number, z: number): Vec3 => {
  const { right, up, forward } = POSED_FOR;
  return {
    x: right.x * x + up.x * y + forward.x * z, y: right.y * x + up.y * y + forward.y * z,
    z: right.z * x + up.z * y + forward.z * z,
  };
};
const TAN = Math.tan(fp.fovRad / 2);
const atEye = ({ x, y, z }: Vec3): Vec3 => {
  const d = fromCamera(x, y, z), { eye } = POSED_FOR;
  return { x: eye.x + d.x, y: eye.y + d.y, z: eye.z + d.z };
};
const spot = ({ x, y, depthM }: { x: number; y: number; depthM: number }, side: 1 | -1): Vec3 =>
  atEye({ x: side * x * TAN * depthM, y: y * TAN * depthM, z: depthM });
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};
const along = (p: Vec3, d: Vec3, m: number): Vec3 => ({ x: p.x + d.x * m, y: p.y + d.y * m, z: p.z + d.z * m });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 =>
  ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/** The arms' pose (the model's frame) as shown in first person; `gripped`: the off hand holds the weapon too. */
export function firstPersonArms(arms: Arms, side: 1 | -1, gripped: boolean): Arms {
  const home = unit(fromCamera(side * FP_ARMS.blade.x, FP_ARMS.blade.y, FP_ARMS.blade.z));
  // A pull over a half keeps a blade pointing straight back from cancelling out.
  const blade = unit(lerp(arms.blade, home, FP_ARMS.bladePull));
  const hand = lerp(arms.hand, spot(FP_ARMS.hand, side), FP_ARMS.handPull);
  const offHand = gripped ? along(hand, blade, -OFF_GRIP_M)
    : lerp(arms.offHand, spot(FP_ARMS.offHand, side), FP_ARMS.offHandPull);
  return { hand, blade, offHand };
}

const axes = [new Vector3(), new Vector3(), new Vector3()] as const, basis = new Matrix();

export function guardInView(way: SwingDir, side: 1 | -1): { hand: Vec3; blade: Vec3; edge: Vec3 } {
  const held = MOTIONS.sword.held(wayCut(way, true)), at = FP_GUARD.hand[side === 1 ? way : mirrorWay(way) as SwingDir];
  const toModel = (v: Vec3) => fromCamera(v.x, v.y, v.z);
  const hand = spot({ ...at, depthM: FP_GUARD.depthM }, side);
  return { hand, blade: toModel(held.blade), edge: toModel(held.edge!) };
}

// Past the side the blade would turn back through the head, so it eases in toward the side instead.
const turnInView = (arcRad: number): number => {
  const easeRad = FP_SWING.sideRad;
  return arcRad < easeRad ? easeRad * Math.exp(arcRad / easeRad - 1)
    : arcRad > Math.PI - easeRad ? Math.PI - easeRad * Math.exp((Math.PI - arcRad) / easeRad - 1) : arcRad;
};

export function swungInView(
  swing: SwingData, alpha: number, side: 1 | -1,
): { hand: Vec3; holding: Quaternion; set: number } {
  const stab = swing.way === "stab", cut = wayCut(swing.way), { hand: at, sweepM, aimDepthM } = FP_SWING;
  const backRad = stab ? Math.PI / 2 : swing.attack === "heavy" ? FP_SWING.heavyBackRad : FP_SWING.backRad;
  const { set, arcRad } = swingArc(swing, alpha, backRad, stab ? Math.PI / 2 : FP_SWING.overRad);
  const turnRad = turnInView(arcRad), c = Math.cos(turnRad), s = Math.sin(turnRad);
  const pushM = stab ? FP_SWING.stabPushM : FP_SWING.pushM;
  const hand = {
    x: side * at.x * TAN * at.depthM - cut.x * sweepM * c, y: at.y * TAN * at.depthM - cut.y * sweepM * c,
    z: at.depthM + pushM * Math.sin(arcRad),
  };
  const aim = unit({ x: -hand.x, y: -hand.y, z: aimDepthM - hand.z });
  let blade: Vec3, flat: Vec3;
  if (stab) {
    blade = aim;
    flat = unit({ x: -aim.x * aim.y, y: 1 - aim.y * aim.y, z: -aim.z * aim.y });
  } else {
    // Drawn back level with the eye rather than down the line from the hand to the middle.
    const ahead = unit(lerp({ x: 0, y: 0, z: 1 }, aim, smoothstep(-backRad, Math.PI / 2, arcRad)));
    const way = { x: cut.x, y: cut.y, z: 0 }, onWay = dot(way, ahead);
    const across = unit({ x: way.x - ahead.x * onWay, y: way.y - ahead.y * onWay, z: way.z - ahead.z * onWay });
    const out = side * FP_SWING.outShare * Math.max(0, Math.abs(cut.y) - Math.abs(cut.x)) * (1 - s);
    blade = unit({
      x: ahead.x * s - across.x * c + out, y: ahead.y * s - across.y * c, z: ahead.z * s - across.z * c,
    });
    const face = cross(across, ahead), off = dot(face, blade);
    flat = unit({ x: face.x - blade.x * off, y: face.y - blade.y * off, z: face.z - blade.z * off });
  }
  const toModel = (v: Vec3) => fromCamera(v.x, v.y, v.z);
  return { hand: atEye(hand), holding: holdingOf(toModel(blade), toModel(cross(blade, flat)), new Quaternion()), set };
}

// Metres from the eye (x right, y up, z ahead). Drawn, the arrow lies along the view, so it points at the crosshair,
// and the grip is pushed `pushM` out as the string comes back: the arms are too short to draw the whole length.
export const FP_BOW = {
  arrow: { x: 0.08, y: -0.24 }, gripM: 0.7, pushM: 0.14, cantRad: 0.2,
  carry: { grip: { x: 0.1, y: -0.31, z: 0.62 }, cantRad: 1, pitchRad: 0.5, offHand: { x: 0.3, y: -0.36, z: 0.75 } },
  flick: { x: 0.04, y: 0.02, z: -0.06 }, kick: { rad: 0.12, peakTime: 0.05 },
} as const;

const carryTurn = new Quaternion(), aimTurn = new Quaternion();

function bowTurn(cantRad: number, pitchRad: number, to: Quaternion): Quaternion {
  const c = Math.cos(cantRad), s = Math.sin(cantRad), cp = Math.cos(pitchRad), sp = Math.sin(pitchRad);
  const [x, y, z] = axes, toModel = (v: Vector3, a: number, b: number, d: number) => {
    const m = fromCamera(a, b, d);
    return v.set(m.x, m.y, m.z);
  };
  toModel(x, c, -s * cp, -s * sp);
  toModel(y, s, c * cp, c * sp);
  toModel(z, 0, -sp, cp);
  Matrix.FromXYZAxesToRef(x, y, z, basis);
  return Quaternion.FromRotationMatrixToRef(basis, to);
}

const kickOf = (t: number): number => (t / FP_BOW.kick.peakTime) * Math.exp(1 - t / FP_BOW.kick.peakTime);

export function bowInView(m: BowMotion, look: BowLook): { hand: Vec3; holding: Quaternion; offHand: Vec3 } {
  const { arrow, gripM, pushM, cantRad, carry, flick, kick } = FP_BOW, raise = Math.min(1, Math.max(0, m.raise));
  const kickRad = m.loosed ? kick.rad * kickOf(m.sinceLoose) : 0, c = Math.cos(cantRad), s = Math.sin(cantRad);
  const ahead = gripM + pushM * m.hand, back = look.braceM + look.drawM * m.hand;
  const grip = {
    x: arrow.x - c * ARROW_REST.x - s * ARROW_REST.y, y: arrow.y + s * ARROW_REST.x - c * ARROW_REST.y, z: ahead,
  };
  const nock = { x: arrow.x + flick.x * m.flick, y: arrow.y + flick.y * m.flick, z: ahead - back + flick.z * m.flick };
  bowTurn(carry.cantRad, carry.pitchRad, carryTurn);
  bowTurn(cantRad, kickRad, aimTurn);
  return {
    hand: atEye(lerp(carry.grip, grip, raise)), holding: Quaternion.Slerp(carryTurn, aimTurn, raise),
    offHand: atEye(lerp(carry.offHand, nock, raise)),
  };
}

const UP = Vector3.Up(), UNTURNED = Quaternion.Identity();

function swordInView(p: PersonDrawing): HeldArms & { swung: { swing: SwingData; set: number } | null } {
  const pose = p.pose!, side = p.bladeSide, { gripped } = pose, rest = firstPersonArms(pose, side, gripped);
  const swung = pose.swing && swungInView(pose.swing.at, pose.swing.alpha, side);
  const block = pose.held?.block ?? null, way = pose.held?.way ?? null, crossed = block === "one" || block === "dual";
  const held = crossed ? pose : way ? guardInView(way, side)
    : { ...rest, edge: edgeToward(rest.blade, POSED_FOR.forward) };
  const hand = swung?.hand ?? held.hand, holding = swung?.holding ?? holdingOf(held.blade, held.edge, new Quaternion());
  const blade = UP.applyRotationQuaternion(holding);
  const offHand = gripped ? along(hand, blade, -OFF_GRIP_M) : block ? pose.offHand : rest.offHand;
  return {
    hand: new Vector3(hand.x, hand.y, hand.z), holding, offHand: new Vector3(offHand.x, offHand.y, offHand.z),
    offHolding: gripped ? holding : pose.off ? holdingOf(pose.off.blade, pose.off.edge, new Quaternion()) : UNTURNED,
    swung: pose.swing && swung && { swing: pose.swing.at, set: swung.set },
  };
}

const rootInverse = new Matrix(), rootTurn = new Quaternion(), holderToRoot = new Matrix(), toRoot = new Quaternion();
const at = new Vector3(), bodyAt = new Vector3(), turned = new Quaternion(), bodyTurned = new Quaternion();
const posed = new Matrix(), seen = new Matrix(), carry = new Matrix(), moved = new Matrix();
const parentInverse = new Matrix(), look = new Vector3(), eye = new Vector3(), scale = new Vector3();
const posedTurn = new Quaternion(), seenTurn = new Quaternion(), posedAt = new Vector3(), seenAt = new Vector3();

export function holdInView(p: PersonDrawing, view: ArenaView, share: number, dt: number): void {
  const { model } = p;
  if (!model || !p.look) return;
  const { joints, holder } = model, side = p.bladeSide;
  const swordSide = side === 1 ? "R" : "L", offSide = side === 1 ? "L" : "R";
  joints.root.computeWorldMatrix(true).invertToRef(rootInverse);
  Quaternion.InverseToRef(joints.root.absoluteRotationQuaternion, rootTurn);
  holder.computeWorldMatrix(true).multiplyToRef(rootInverse, holderToRoot);
  rootTurn.multiplyToRef(holder.absoluteRotationQuaternion, toRoot);

  let shown: Omit<HeldArms, "offHolding"> & { offHolding: Quaternion | null };
  if (p.blade?.bow) {
    const bow = bowInView(p.bow, p.blade.bow.look), v = (a: Vec3) => new Vector3(a.x, a.y, a.z);
    shown = { hand: v(bow.hand), holding: bow.holding, offHand: v(bow.offHand), offHolding: null };
    p.inView = null;
  } else if (p.pose) {
    const want = swordInView(p);
    shown = p.inView = easeArms(p.inView, want, { key: heldKey(p.pose), side, swung: want.swung,
      shiftTime: shiftTimeOf(p), returnTime: FP_SWING.returnTime, dt, ahead: POSED_FOR.forward });
  } else return;
  const pole = (s: 1 | -1) => {
    const { x, y, z } = lerp(ARM_POLE, FP_ARMS.pole, share);
    return { x: s * x, y, z };
  };
  const reach = (
    s: "R" | "L", hand: Vector3, holding: Quaternion | null, poleSide: 1 | -1, look: WeaponLook | null,
  ) => {
    const bone = joints[`hand.${s}`];
    Vector3.TransformCoordinatesToRef(bone.getAbsolutePosition(), rootInverse, bodyAt);
    rootTurn.multiplyToRef(bone.absoluteRotationQuaternion, bodyTurned);
    Vector3.TransformCoordinatesToRef(hand, holderToRoot, at);
    Vector3.LerpToRef(bodyAt, at, share, at);
    if (holding) Quaternion.SlerpToRef(bodyTurned, toRoot.multiplyToRef(holding, turned), share, turned);
    else turned.copyFrom(bodyTurned);
    // All in first person the body's hidden, and going round it the arm would step as it sweeps.
    reachWith(joints, p.look!.body, s, at, turned, pole(poleSide), bladeReach(look), share < 1);
  };
  const lookOf = (held: { weapon: keyof typeof WEAPON_LOOKS } | null) => held && WEAPON_LOOKS[held.weapon];
  reach(swordSide, shown.hand, shown.holding, side, lookOf(p.blade));
  reach(offSide, shown.offHand, shown.offHolding, -side as 1 | -1, lookOf(p.offBlade));

  const { right, up, forward } = POSED_FOR;
  Matrix.FromXYZAxesToRef(axes[0].set(right.x, right.y, right.z), axes[1].set(up.x, up.y, up.z),
    axes[2].set(forward.x, forward.y, forward.z), posed);
  posed.setTranslationFromFloats(POSED_FOR.eye.x, POSED_FOR.eye.y, POSED_FOR.eye.z);
  posed.multiplyToRef(holder.getWorldMatrix(), posed);
  eye.set(view.eye.x, view.eye.y, view.eye.z);
  look.set(view.at.x, view.at.y, view.at.z).subtractInPlace(eye).normalize();
  Vector3.CrossToRef(Vector3.UpReadOnly, look, axes[0]).normalize();
  Vector3.CrossToRef(look, axes[0], axes[1]);
  Matrix.FromXYZAxesToRef(axes[0], axes[1], look, seen);
  seen.setTranslation(eye);
  posed.decompose(scale, posedTurn, posedAt);
  seen.decompose(scale, seenTurn, seenAt);
  Quaternion.SlerpToRef(posedTurn, seenTurn, share, seenTurn);
  Vector3.LerpToRef(posedAt, seenAt, share, seenAt);
  Matrix.ComposeToRef(Vector3.OneReadOnly, seenTurn, seenAt, seen);
  posed.invert().multiplyToRef(seen, carry);
  for (const s of [swordSide, offSide] as const) carryBone(joints[`upper_arm.${s}`], carry);
}

function carryBone(bone: TransformNode, by: Matrix): void {
  bone.computeWorldMatrix(true).multiplyToRef(by, moved);
  (bone.parent as TransformNode).getWorldMatrix().invertToRef(parentInverse);
  moved.multiplyToRef(parentInverse, moved);
  bone.rotationQuaternion ??= new Quaternion();
  moved.decompose(scale, bone.rotationQuaternion, bone.position);
  bone.computeWorldMatrix(true);
  // Already computed this frame, the arm's own parts and what it holds would keep their old place.
  for (const n of bone.getDescendants(false)) if (n instanceof TransformNode) n.computeWorldMatrix(true);
}

/** The shoulders back where the body has them, as `holdInView` moved them. */
export function restShoulders(p: PersonDrawing): void {
  if (!p.model || !p.look) return;
  for (const s of ["R", "L"] as const) {
    const { x, y, z } = restAt(`upper_arm.${s}`, p.look.body);
    p.model.joints[`upper_arm.${s}`].position.set(x, y, z);
  }
}
