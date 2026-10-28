import {
  Matrix, MeshBuilder, Quaternion, TransformNode, Vector3, type Mesh, type Scene, type StandardMaterial,
} from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";

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

type Part = (mesh: Mesh, under: TransformNode, material: StandardMaterial) => Mesh;

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
}

/** Its meshes hang under the model; `hand` is where a held thing goes, its +y along what it holds. */
export interface Arm {
  bones: ArmBones;
  shoulder: Vector3;
  chest: TransformNode | null;
  pole: Vec3;
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
  part(MeshBuilder.CreateSphere("arm-fist", { diameter: t * 1.15, segments: 6 }, scene), hand, look.fist);
  return {
    bones, chest, upper, fore, elbow, hand,
    shoulder: new Vector3(look.shoulder.x, look.shoulder.y, look.shoulder.z),
    pole: unit(look.side * 0.5, -0.8, -0.45),
  };
}

const chestTurn = new Matrix(), shoulderAt = new Vector3(), up = new Vector3(0, 1, 0), dir = new Vector3();

function placeBone(bone: Mesh, from: Vec3, to: Vec3): void {
  bone.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  dir.set(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
  bone.rotationQuaternion ??= new Quaternion();
  Quaternion.FromUnitVectorsToRef(up, dir, bone.rotationQuaternion);
}

/** `target` is in the model's frame; out of reach, the hand stops at arm's length. */
export function poseArm(arm: Arm, target: Vec3): void {
  if (arm.chest) {
    const { rotation, position } = arm.chest;
    Matrix.RotationYawPitchRollToRef(rotation.y, rotation.x, rotation.z, chestTurn);
    Vector3.TransformCoordinatesToRef(arm.shoulder, chestTurn, shoulderAt).addInPlace(position);
  } else {
    shoulderAt.copyFrom(arm.shoulder);
  }
  const { elbow, hand } = reachArm(shoulderAt, target, arm.bones, arm.pole);
  placeBone(arm.upper, shoulderAt, elbow);
  placeBone(arm.fore, elbow, hand);
  arm.elbow.position.set(elbow.x, elbow.y, elbow.z);
  arm.hand.position.set(hand.x, hand.y, hand.z);
}
