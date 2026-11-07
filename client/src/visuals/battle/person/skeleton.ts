import { TransformNode, type Scene } from "@babylonjs/core";
import type { Look, Vec3 } from "@infinite-tower/shared";
import { VIEWS } from "../../../gfx/look/art.js";
import { BATTLE_BUILDS } from "../../../gfx/look/body.js";
import { SPRITE_SIZE } from "../pose.js";

export const M_PER_PX = SPRITE_SIZE / VIEWS.battle.width;
const px = (n: number): number => n * M_PER_PX;

export const JOINTS = [
  "root", "hips", "spine", "chest", "neck", "head", "crown", "hair", "back",
  "upper_arm.R", "forearm.R", "hand.R", "grip.R", "upper_arm.L", "forearm.L", "hand.L", "grip.L",
  "thigh.R", "shin.R", "foot.R", "thigh.L", "shin.L", "foot.L",
] as const;
export type JointName = (typeof JOINTS)[number];

export interface Joint {
  name: JointName;
  parent: JointName | null;
  /** From its parent, in metres, at rest: feet at 0, +y up, +z ahead, +x the body's right. */
  at: Vec3;
  /** At rest, radians (Babylon's Euler order); none so far. */
  rest?: Vec3;
  /** Its x is the medium body's, scaled by this width of the body type's battle build. */
  widthBy?: "shoulder" | "hip";
}

// Sprite rows (battle.ts' stand, feet on row 64): ankle 61.5, knee 56, top of the legs 50, waist 44, chest 38,
// shoulder joint 34, base of the neck 32.4, base of the skull 29.5. An arm hangs 13.2 rows to the hand.
const UPPER_ARM_PX = 6.6, FOREARM_PX = 6.6, THIGH_PX = 6, SHIN_PX = 5.5;
const v = (x: number, y: number, z: number): Vec3 => ({ x: px(x), y: px(y), z: px(z) });

/** One rig for every body. Arms and legs hang straight down at rest. */
export const SKELETON: readonly Joint[] = [
  { name: "root", parent: null, at: v(0, 0, 0) },
  { name: "hips", parent: "root", at: v(0, 14, 0) },
  { name: "spine", parent: "hips", at: v(0, 6, 0) },
  { name: "chest", parent: "spine", at: v(0, 6, 0) },
  { name: "neck", parent: "chest", at: v(0, 5.6, 0) },
  { name: "head", parent: "neck", at: v(0, 2.9, 0) },
  { name: "crown", parent: "head", at: v(0, 19, 0) },
  { name: "hair", parent: "head", at: v(0, 11.3, -8.6) },
  { name: "back", parent: "chest", at: v(0, 1.5, -4) },
  { name: "upper_arm.R", parent: "chest", at: v(7, 2.4, 0), widthBy: "shoulder" },
  { name: "forearm.R", parent: "upper_arm.R", at: v(0, -UPPER_ARM_PX, 0) },
  { name: "hand.R", parent: "forearm.R", at: v(0, -FOREARM_PX, 0) },
  { name: "grip.R", parent: "hand.R", at: v(0, 0, 0) },
  { name: "upper_arm.L", parent: "chest", at: v(-7, 2.4, 0), widthBy: "shoulder" },
  { name: "forearm.L", parent: "upper_arm.L", at: v(0, -UPPER_ARM_PX, 0) },
  { name: "hand.L", parent: "forearm.L", at: v(0, -FOREARM_PX, 0) },
  { name: "grip.L", parent: "hand.L", at: v(0, 0, 0) },
  { name: "thigh.R", parent: "hips", at: v(3.3, 0, 0), widthBy: "hip" },
  { name: "shin.R", parent: "thigh.R", at: v(0, -THIGH_PX, 0) },
  { name: "foot.R", parent: "shin.R", at: v(0, -SHIN_PX, 0) },
  { name: "thigh.L", parent: "hips", at: v(-3.3, 0, 0), widthBy: "hip" },
  { name: "shin.L", parent: "thigh.L", at: v(0, -THIGH_PX, 0) },
  { name: "foot.L", parent: "shin.L", at: v(0, -SHIN_PX, 0) },
];

export const JOINT_OF = Object.fromEntries(SKELETON.map((j) => [j.name, j])) as Record<JointName, Joint>;

export function restAt(name: JointName, body: Look["body"]): Vec3 {
  const { at, widthBy } = JOINT_OF[name];
  if (!widthBy) return at;
  return { ...at, x: at.x * BATTLE_BUILDS[body][widthBy] / BATTLE_BUILDS.medium[widthBy] };
}

export function restInModel(name: JointName, body: Look["body"]): Vec3 {
  let x = 0, y = 0, z = 0;
  for (let j: Joint | null = JOINT_OF[name]; j; j = j.parent ? JOINT_OF[j.parent] : null) {
    const at = restAt(j.name, body);
    x += at.x;
    y += at.y;
    z += at.z;
  }
  return { x, y, z };
}

export type Joints = Record<JointName, TransformNode>;

export function buildSkeleton(scene: Scene, parent: TransformNode, body: Look["body"]): Joints {
  const joints = {} as Joints;
  for (const j of SKELETON) {
    const node = new TransformNode(`person-${j.name}`, scene);
    node.parent = j.parent ? joints[j.parent] : parent;
    const at = restAt(j.name, body);
    node.position.set(at.x, at.y, at.z);
    if (j.rest) node.rotation.set(j.rest.x, j.rest.y, j.rest.z);
    joints[j.name] = node;
  }
  return joints;
}
