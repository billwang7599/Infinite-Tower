import { Matrix, Quaternion, TransformNode, Vector3 } from "@babylonjs/core";
import { PLAYER, type Vec3 } from "@infinite-tower/shared";
import { CAMERA_VIEWS, type ArenaView } from "../../modes/battle/camera.js";
import { orbitBack } from "../../modes/orbit.js";
import { reachWith, type PersonDrawing } from "./person/animation.js";
import { restAt } from "./person/skeleton.js";

export interface Arms { hand: Vec3; blade: Vec3; offHand: Vec3 }

// Screen spots (shares of the half-height from the middle, for the right hand; mirrored for the left) the hands are
// pulled toward, `depthM` ahead of the eye; the blade leans toward `blade` (x right, y up, z ahead).
export const FP_ARMS = {
  hand: { x: 0.12, y: -0.6, depthM: 0.7 }, offHand: { x: -0.32, y: -0.62, depthM: 0.7 },
  blade: { x: -0.15, y: 0.6, z: 1 }, handPull: 0.6, offHandPull: 0.8, bladePull: 0.6, pole: { x: 0.5, y: -0.8, z: -0.2 },
} as const;

const fp = CAMERA_VIEWS.fp, back = orbitBack(0, fp.lockPitchRad);
/** The first-person view the arms are posed for, in the model's frame (feet at 0, +z ahead). */
export const POSED_FOR = {
  eye: { x: 0, y: PLAYER.height / 2 + fp.orbitHeightM + back.y * fp.distanceM, z: back.z * fp.distanceM },
  right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: -back.z, z: back.y }, forward: { x: -back.x, y: -back.y, z: -back.z },
} as const;

const fromCamera = (x: number, y: number, z: number): Vec3 => {
  const { right, up, forward } = POSED_FOR;
  return {
    x: right.x * x + up.x * y + forward.x * z, y: right.y * x + up.y * y + forward.y * z,
    z: right.z * x + up.z * y + forward.z * z,
  };
};
const TAN = Math.tan(fp.fovRad / 2);
function spot({ x, y, depthM }: { x: number; y: number; depthM: number }, side: 1 | -1): Vec3 {
  const d = fromCamera(side * x * TAN * depthM, y * TAN * depthM, depthM), { eye } = POSED_FOR;
  return { x: eye.x + d.x, y: eye.y + d.y, z: eye.z + d.z };
}
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};
const turn = new Quaternion(), from = new Vector3(), to = new Vector3(), offset = new Vector3();

/** The arms' pose (the model's frame) as shown in first person; `gripped`: the off hand holds the weapon too. */
export function firstPersonArms(arms: Arms, side: 1 | -1, gripped: boolean): Arms {
  const home = unit(fromCamera(side * FP_ARMS.blade.x, FP_ARMS.blade.y, FP_ARMS.blade.z));
  // A pull over a half keeps a blade pointing straight back from cancelling out.
  const blade = unit(lerp(arms.blade, home, FP_ARMS.bladePull));
  const hand = lerp(arms.hand, spot(FP_ARMS.hand, side), FP_ARMS.handPull);
  if (!gripped) return { hand, blade, offHand: lerp(arms.offHand, spot(FP_ARMS.offHand, side), FP_ARMS.offHandPull) };
  Quaternion.FromUnitVectorsToRef(from.set(arms.blade.x, arms.blade.y, arms.blade.z), to.set(blade.x, blade.y, blade.z),
    turn);
  offset.set(arms.offHand.x - arms.hand.x, arms.offHand.y - arms.hand.y, arms.offHand.z - arms.hand.z)
    .applyRotationQuaternionInPlace(turn);
  return { hand, blade, offHand: { x: hand.x + offset.x, y: hand.y + offset.y, z: hand.z + offset.z } };
}

const rootInverse = new Matrix(), offAt = new Vector3(), look = new Vector3(), upward = Vector3.Up();
const bladeAt = new Vector3();
const holding = new Quaternion(), offHolding = new Quaternion(), rootTurn = new Quaternion();
const posed = new Matrix(), seen = new Matrix(), carry = new Matrix(), moved = new Matrix();
const parentInverse = new Matrix();
const axes = [new Vector3(), new Vector3(), new Vector3()] as const, eye = new Vector3(), scale = new Vector3();

/** After `framePerson`: the arms posed as in first person, then carried along with the camera as it turns and tilts. */
export function holdInView(p: PersonDrawing, view: ArenaView, gripped: boolean): void {
  const { model } = p;
  if (!model || !p.handAt || !p.bladeTurn) return;
  const { joints } = model, side = p.bladeSide, swordSide = side === 1 ? "R" : "L", offSide = side === 1 ? "L" : "R";
  joints.root.computeWorldMatrix(true).invertToRef(rootInverse);
  Quaternion.InverseToRef(joints.root.absoluteRotationQuaternion, rootTurn);
  const off = joints[`hand.${offSide}`];
  off.computeWorldMatrix(true);
  Vector3.TransformCoordinatesToRef(off.getAbsolutePosition(), rootInverse, offAt);
  rootTurn.multiplyToRef(off.absoluteRotationQuaternion, offHolding);
  upward.applyRotationQuaternionToRef(p.bladeTurn, bladeAt);
  const arms = firstPersonArms({ hand: p.handAt, blade: bladeAt, offHand: offAt }, side, gripped);
  Quaternion.FromUnitVectorsToRef(bladeAt, to.set(arms.blade.x, arms.blade.y, arms.blade.z), turn);
  turn.multiplyToRef(p.bladeTurn, holding);
  if (gripped) turn.multiplyToRef(offHolding, offHolding);
  const pole = { ...FP_ARMS.pole, x: side * FP_ARMS.pole.x };
  reachWith(joints, swordSide, arms.hand, holding, pole);
  reachWith(joints, offSide, arms.offHand, offHolding, { ...pole, x: -pole.x });

  const { right, up, forward } = POSED_FOR;
  Matrix.FromXYZAxesToRef(axes[0].set(right.x, right.y, right.z), axes[1].set(up.x, up.y, up.z),
    axes[2].set(forward.x, forward.y, forward.z), posed);
  posed.setTranslationFromFloats(POSED_FOR.eye.x, POSED_FOR.eye.y, POSED_FOR.eye.z);
  posed.multiplyToRef(model.holder.computeWorldMatrix(true), posed);
  eye.set(view.eye.x, view.eye.y, view.eye.z);
  look.set(view.at.x, view.at.y, view.at.z).subtractInPlace(eye).normalize();
  Vector3.CrossToRef(Vector3.UpReadOnly, look, axes[0]).normalize();
  Vector3.CrossToRef(look, axes[0], axes[1]);
  Matrix.FromXYZAxesToRef(axes[0], axes[1], look, seen);
  seen.setTranslation(eye);
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
