import type { BattleBuild } from "../../../gfx/look/battle.js";
import type { Section } from "./loft.js";
import { M_PER_PX, restAt, restInModel, type JointName } from "./skeleton.js";

export type RampName = "skin" | "cloth" | "accent" | "leather" | "wool" | "linen";

export type BodyPart = "pelvis" | "belly" | "ribs" | "neck" | "upperArm" | "forearm" | "hand" | "thigh" | "shin" | "foot";
export interface Shape { joints: readonly JointName[]; sections: (b: BattleBuild) => Section[]; roundness?: number }

const limbs = (bone: string): JointName[] => [`${bone}.R`, `${bone}.L`] as JointName[];
const boneLength = (j: JointName) => -restAt(j, "medium").y / M_PER_PX;
const UPPER = boneLength("forearm.R"), FORE = boneLength("hand.R"), THIGH = boneLength("shin.R");
const SHIN = boneLength("foot.R"), ANKLE = restInModel("foot.R", "medium").y / M_PER_PX;
const legHalf = (b: BattleBuild) => b.hip / 2 + 0.1;

/** Sprite pixels from each part's joint, after the battle sprite's stand (battle.ts). */
export const SHAPES: Record<BodyPart, Shape> = {
  pelvis: { joints: ["hips"], sections: (b) => [
    { y: -1.6, x: b.hip - 1.2, z: b.hip * 0.6 }, { y: 0.4, x: b.hip, z: b.hip * 0.66 },
    { y: 6.4, x: b.waist, z: b.waist * 0.7 },
  ] },
  belly: { joints: ["spine"], sections: (b) => [
    { y: -0.4, x: b.waist, z: b.waist * 0.7 }, { y: 1.4, x: b.waist, z: b.waist * 0.72 },
    { y: 6.4, x: b.shoulder - 1.2, z: (b.shoulder - 1.2) * 0.6 },
  ] },
  ribs: { joints: ["chest"], sections: (b) => [
    { y: -0.3, x: b.shoulder - 1.3, z: (b.shoulder - 1.3) * 0.6 }, { y: 2, x: b.shoulder - 0.6, z: b.shoulder * 0.58 },
    { y: 3.5, x: b.shoulder - 0.8, z: b.shoulder * 0.55 }, { y: 4.7, x: b.shoulder - 2.4, z: b.shoulder * 0.48 },
    { y: 5.6, x: b.neck + 1.2, z: b.neck + 0.8 },
  ] },
  neck: { joints: ["neck"], roundness: 2, sections: (b) => [
    { y: -1, x: b.neck, z: b.neck }, { y: 3.5, x: b.neck * 0.95, z: b.neck * 0.95 },
  ] },
  upperArm: { joints: limbs("upper_arm"), roundness: 2, sections: (b) => [
    { y: -UPPER, x: b.arm * 0.4, z: b.arm * 0.4 }, { y: -0.4, x: b.arm * 0.55, z: b.arm * 0.5 },
    { y: 1, x: b.arm * 0.4, z: b.arm * 0.4 },
  ] },
  forearm: { joints: limbs("forearm"), roundness: 2, sections: (b) => [
    { y: -FORE + 0.6, x: b.arm * 0.3, z: b.arm * 0.3 }, { y: 0.4, x: b.arm * 0.42, z: b.arm * 0.42 },
  ] },
  hand: { joints: limbs("hand"), roundness: 2, sections: (b) => [
    { y: -1.6, x: b.arm * 0.28, z: b.arm * 0.28 }, { y: -0.3, x: b.arm * 0.45, z: b.arm * 0.38 },
    { y: 0.8, x: b.arm * 0.32, z: b.arm * 0.3 },
  ] },
  thigh: { joints: limbs("thigh"), sections: (b) => [
    { y: -THIGH, x: legHalf(b) * 0.78, z: legHalf(b) * 0.8 }, { y: 1, x: legHalf(b), z: legHalf(b) * 0.95 },
  ] },
  shin: { joints: limbs("shin"), sections: (b) => [
    { y: -SHIN + 0.3, x: legHalf(b) * 0.62, z: legHalf(b) * 0.62 }, { y: -2, x: legHalf(b) * 0.82, z: legHalf(b) * 0.85 },
    { y: 0.3, x: legHalf(b) * 0.78, z: legHalf(b) * 0.8 },
  ] },
  foot: { joints: limbs("foot"), sections: (b) => [
    { y: -ANKLE, x: legHalf(b) * 0.85, z: legHalf(b) * 1.35, dz: 1.3 },
    { y: -ANKLE + 1.6, x: legHalf(b) * 0.8, z: legHalf(b) * 1.2, dz: 1.1 },
    { y: 0.6, x: legHalf(b) * 0.62, z: legHalf(b) * 0.65 },
  ] },
};

interface Extra { on: BodyPart; ramp: RampName; band?: { from: number; to: number; grow: number }; sections?: Shape["sections"] }
/** Later pieces lie over earlier ones. */
export interface PersonWear { covers: Partial<Record<BodyPart, RampName>>; extras?: readonly Extra[] }

export const STARTER_WEAR: Readonly<Record<string, PersonWear>> = {
  trousers: { covers: { pelvis: "wool", thigh: "wool", shin: "wool" } },
  boots: {
    covers: { shin: "leather", foot: "leather" },
    extras: [{ on: "shin", ramp: "leather", band: { from: -0.6, to: 0.5, grow: 0.45 } }],
  },
  tunic: {
    covers: { belly: "cloth", ribs: "cloth", upperArm: "cloth", forearm: "cloth" },
    extras: [
      { on: "pelvis", ramp: "cloth", sections: (b) => [
        { y: 0.9, x: b.hip + 1, z: (b.hip + 1) * 0.78 }, { y: 4, x: b.hip + 0.3, z: b.hip * 0.72 },
        { y: 6.6, x: b.waist + 0.4, z: (b.waist + 0.4) * 0.74 },
      ] },
      { on: "pelvis", ramp: "accent", sections: (b) => [
        { y: 0.7, x: b.hip + 1.2, z: (b.hip + 1.2) * 0.78 }, { y: 1.4, x: b.hip + 1.1, z: (b.hip + 1.1) * 0.78 },
      ] },
      { on: "belly", ramp: "leather", band: { from: -0.5, to: 1, grow: 0.4 } },
      { on: "ribs", ramp: "linen", band: { from: 4.9, to: 5.7, grow: 0.35 } },
      { on: "forearm", ramp: "accent", band: { from: -FORE + 0.6, to: -FORE + 1.3, grow: 0.25 } },
    ],
  },
};

