import type { Equipment, ItemId, Slot } from "@infinite-tower/shared";
import type { ItemMaterial } from "../../../gfx/items/items.js";
import type { BattleBuild } from "../../../gfx/look/battle.js";
import { sectionAt, type Section } from "./loft.js";
import { M_PER_PX, restAt, restInModel, type JointName } from "./skeleton.js";

/** The look's ramps win over an item's of the same name. */
export type RampName = "skin" | "cloth" | "accent" | "wool" | "linen" | ItemMaterial;

export type BodyPart =
  | "pelvis" | "belly" | "ribs" | "neck" | "shoulder" | "upperArm" | "forearm" | "hand" | "thigh" | "shin" | "foot";
export interface Shape { joints: readonly JointName[]; sections: (b: BattleBuild) => Section[]; roundness?: number }

const limbs = (bone: string): JointName[] => [`${bone}.R`, `${bone}.L`] as JointName[];
const boneLength = (j: JointName) => -restAt(j, "medium").y / M_PER_PX;
const UPPER = boneLength("forearm.R"), FORE = boneLength("hand.R"), THIGH = boneLength("shin.R");
const SHIN = boneLength("foot.R"), ANKLE = restInModel("foot.R", "medium").y / M_PER_PX;
const legHalf = (b: BattleBuild) => b.hip / 2 + 0.1;

/** Sprite pixels from each part's joint, after the battle sprite's stand (battle.ts). */
export const SHAPES: Record<BodyPart, Shape> = {
  pelvis: { joints: ["hips"], sections: (b) => [
    { y: -1.6, x: b.hip - 1.4, z: b.hip * 0.58, dz: -0.1 }, { y: 0.6, x: b.hip, z: b.hip * 0.68, dz: -0.25 },
    { y: 3.4, x: b.hip - 0.25, z: b.hip * 0.66, dz: -0.15 }, { y: 6.4, x: b.waist, z: b.waist * 0.7 },
  ] },
  belly: { joints: ["spine"], sections: (b) => [
    { y: -0.4, x: b.waist, z: b.waist * 0.7 }, { y: 2.5, x: b.waist - 0.25, z: b.waist * 0.68, dz: 0.2 },
    { y: 6.4, x: b.waist + 0.3, z: b.waist * 0.74, dz: 0.15 },
  ] },
  ribs: { joints: ["chest"], sections: (b) => [
    { y: -0.3, x: b.waist + 0.2, z: b.waist * 0.73, dz: 0.15 },
    { y: 1.8, x: b.shoulder - 2, z: b.shoulder * 0.57, dz: 0.35 },
    { y: 3.4, x: b.shoulder - 2.1, z: b.shoulder * 0.55, dz: 0.15 },
    { y: 4.7, x: b.shoulder - 3, z: b.shoulder * 0.45, dz: -0.2 },
    { y: 5.6, x: b.neck + 1.3, z: b.neck + 0.8, dz: -0.2 },
  ] },
  neck: { joints: ["neck"], roundness: 2, sections: (b) => [
    { y: -1, x: b.neck, z: b.neck }, { y: 3.5, x: b.neck * 0.95, z: b.neck * 0.95 },
  ] },
  shoulder: { joints: limbs("upper_arm"), roundness: 2, sections: (b) => [
    { y: -3.6, x: b.arm * 0.4, z: b.arm * 0.42 }, { y: -1.8, x: b.arm * 0.56, z: b.arm * 0.55 },
    { y: 0.4, x: b.arm * 0.58, z: b.arm * 0.56 }, { y: 1.7, x: b.arm * 0.42, z: b.arm * 0.42 },
    { y: 2.3, x: b.arm * 0.12, z: b.arm * 0.12 },
  ] },
  upperArm: { joints: limbs("upper_arm"), roundness: 2, sections: (b) => [
    { y: -UPPER, x: b.arm * 0.33, z: b.arm * 0.35 }, { y: -UPPER * 0.5, x: b.arm * 0.43, z: b.arm * 0.48, dz: 0.25 },
    { y: -1.6, x: b.arm * 0.46, z: b.arm * 0.46 }, { y: 0.8, x: b.arm * 0.4, z: b.arm * 0.4 },
  ] },
  forearm: { joints: limbs("forearm"), roundness: 2, sections: (b) => [
    { y: -FORE + 0.6, x: b.arm * 0.28, z: b.arm * 0.22 }, { y: -FORE * 0.35, x: b.arm * 0.4, z: b.arm * 0.37, dz: 0.1 },
    { y: 0.4, x: b.arm * 0.34, z: b.arm * 0.35 },
  ] },
  hand: { joints: limbs("hand"), roundness: 2, sections: (b) => [
    { y: -1.6, x: b.arm * 0.26, z: b.arm * 0.24 }, { y: -0.3, x: b.arm * 0.42, z: b.arm * 0.32 },
    { y: 0.8, x: b.arm * 0.3, z: b.arm * 0.26 },
  ] },
  thigh: { joints: limbs("thigh"), sections: (b) => [
    { y: -THIGH, x: legHalf(b) * 0.72, z: legHalf(b) * 0.76 },
    { y: -THIGH * 0.45, x: legHalf(b) * 0.92, z: legHalf(b) * 0.95, dz: 0.15 },
    { y: 1, x: legHalf(b), z: legHalf(b) * 0.95 },
  ] },
  shin: { joints: limbs("shin"), sections: (b) => [
    { y: -SHIN + 0.3, x: legHalf(b) * 0.56, z: legHalf(b) * 0.58 },
    { y: -SHIN * 0.45, x: legHalf(b) * 0.8, z: legHalf(b) * 0.86, dz: -0.3 },
    { y: 0.3, x: legHalf(b) * 0.72, z: legHalf(b) * 0.76 },
  ] },
  foot: { joints: limbs("foot"), sections: (b) => [
    { y: -ANKLE, x: legHalf(b) * 0.85, z: legHalf(b) * 1.35, dz: 1.3 },
    { y: -ANKLE + 1.6, x: legHalf(b) * 0.8, z: legHalf(b) * 1.2, dz: 1.1 },
    { y: 0.6, x: legHalf(b) * 0.62, z: legHalf(b) * 0.65 },
  ] },
};

/** On a body part's joints (`side`: one of a pair only), or rigid on the crown or back joint. */
interface Extra {
  on: BodyPart | "crown" | "back";
  ramp: RampName;
  band?: { from: number; to: number; grow: number };
  sections?: Shape["sections"];
  side?: "R" | "L";
  roundness?: number;
}
/** Later pieces lie over earlier ones. */
export interface PersonWear { covers: Partial<Record<BodyPart, RampName>>; extras?: readonly Extra[] }

/** Keyed by the slot each fills, so something worn there replaces it. */
export const STARTER_WEAR: Readonly<Record<string, PersonWear>> = {
  legs: { covers: { pelvis: "wool", thigh: "wool", shin: "wool" } },
  boots: {
    covers: { shin: "leather", foot: "leather" },
    extras: [{ on: "shin", ramp: "leather", band: { from: -0.6, to: 0.5, grow: 0.45 } }],
  },
  body: {
    covers: { belly: "cloth", ribs: "cloth", shoulder: "cloth", upperArm: "cloth", forearm: "cloth" },
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

// On the crown joint a hat sits on the hair: the head's half-sizes (head.ts) × 1.1, its middle 10.5 px down.
const SACK_DEPTH = 3;
/** Where the ribs' back is from the back joint (px, +z ahead), so a backpack rests on it. */
const ribsBack = (b: BattleBuild) => 4.35 - 0.57 * b.shoulder;
const sackAt = (b: BattleBuild) => ribsBack(b) - SACK_DEPTH + 0.3;
const ribsFront = (b: BattleBuild, y: number) => {
  const s = sectionAt(SHAPES.ribs.sections(b), y);
  return s.z + (s.dz ?? 0);
};
const shoulderStrap = (dx: number): Extra => ({
  on: "ribs", ramp: "leather", sections: (b) => [0.6, 3.4, 5].map((y) => ({ y, x: 0.7, z: 0.35, dx,
    dz: ribsFront(b, y) })),
});
const backStrap = (dx: number): Extra => ({
  on: "back", ramp: "leather", sections: (b) => [-7.6, -1.4].map((y) => ({ y, x: 0.65, z: 0.45, dx,
    dz: sackAt(b) - SACK_DEPTH })),
});

// Rings are too small to show.
export const WORN: Partial<Record<ItemId, PersonWear>> = {
  "wool-cap": { covers: {}, extras: [
    { on: "crown", ramp: "greyfur", sections: () => [
      { y: -7, x: 10.9, z: 10.6 }, { y: -5.4, x: 10.8, z: 10.5 }, { y: -5.3, x: 10.1, z: 9.8 },
      { y: -2.5, x: 7.9, z: 7.7 }, { y: -0.2, x: 4.6, z: 4.4 }, { y: 1.2, x: 1.4, z: 1.4 },
    ] },
    { on: "crown", ramp: "fat", roundness: 2, sections: () => [
      { y: 0.8, x: 1.3, z: 1.3 }, { y: 2.1, x: 2.3, z: 2.3 }, { y: 3.5, x: 1.7, z: 1.7 }, { y: 4, x: 0.3, z: 0.3 },
    ] },
  ] },
  "feathered-hat": { covers: {}, extras: [
    { on: "crown", ramp: "oxblood", roundness: 2, sections: () => [
      { y: -6.6, x: 15.5, z: 15 }, { y: -5.8, x: 15.5, z: 15 },
    ] },
    { on: "crown", ramp: "oxblood", sections: () => [
      { y: -6, x: 10.7, z: 10.4 }, { y: -1.5, x: 9.6, z: 9.3 }, { y: 2, x: 8.4, z: 8 }, { y: 2.6, x: 5.5, z: 5.2 },
    ] },
    { on: "crown", ramp: "fat", roundness: 2, sections: () => [
      { y: -3, x: 0.5, z: 0.5, dx: 8.5, dz: -4 }, { y: 0, x: 1.8, z: 1.2, dx: 10, dz: -7 },
      { y: 4, x: 1.6, z: 1.1, dx: 11, dz: -10.5 }, { y: 7, x: 0.3, z: 0.3, dx: 11.5, dz: -13 },
    ] },
  ] },
  "canvas-backpack": { covers: {}, extras: [
    { on: "back", ramp: "canvas", roundness: 3.5, sections: (b) => [
      { y: -9, x: 5.2, z: 2.6 }, { y: -8, x: 5.9, z: SACK_DEPTH }, { y: 1.5, x: 5.9, z: SACK_DEPTH },
      { y: 3.2, x: 5.2, z: 2.6 },
    ].map((s) => ({ ...s, dz: sackAt(b) })) },
    { on: "back", ramp: "canvas", roundness: 3.5, sections: (b) => [
      { y: -1.5, x: 6.2, z: SACK_DEPTH + 0.25 }, { y: 3.6, x: 5.4, z: SACK_DEPTH - 0.15 },
    ].map((s) => ({ ...s, dz: sackAt(b) })) },
    backStrap(-2.8), backStrap(2.8), shoulderStrap(-3.2), shoulderStrap(3.2),
  ] },
  "leather-belt": { covers: {}, extras: [
    { on: "belly", ramp: "leather", band: { from: -1, to: 1.2, grow: 0.7 } },
    { on: "belly", ramp: "steel", roundness: 4, sections: (b) => [-0.9, 1.1].map((y) => ({
      y, x: 1.4, z: 0.5, dz: b.waist * 0.7 + 0.6,
    })) },
  ] },
  "braided-bracelet": { covers: {}, extras: [
    { on: "forearm", ramp: "cork", band: { from: -FORE + 1.4, to: -FORE + 2.8, grow: 0.55 } },
  ] },
};

const SHOWN = [
  "legs", "boots", "body", "belt", "back", "leftWrist", "rightWrist", "head", "cap",
] as const satisfies readonly Slot[];
type ShownSlot = (typeof SHOWN)[number];
export type ShownGear = Partial<Record<ShownSlot, ItemId>>;
const COSMETIC_OVER: Partial<Record<ShownSlot, Slot>> = {
  cap: "capCosmetic", head: "headCosmetic", body: "bodyCosmetic", legs: "legsCosmetic", boots: "bootsCosmetic",
};

export function shownGear(equipment: Equipment): ShownGear {
  const shown: ShownGear = {};
  for (const slot of SHOWN) {
    const over = COSMETIC_OVER[slot], item = (over && equipment[over]) || equipment[slot];
    if (item && WORN[item]) shown[slot] = item;
  }
  return shown;
}

export function wearOf(shown: ShownGear): Record<string, PersonWear> {
  const wear: Record<string, PersonWear> = { ...STARTER_WEAR };
  for (const [slot, item] of Object.entries(shown) as [ShownSlot, ItemId][]) {
    const look = WORN[item]!, side = slot === "leftWrist" ? "L" : slot === "rightWrist" ? "R" : undefined;
    wear[slot] = side ? { ...look, extras: look.extras?.map((x) => ({ ...x, side })) } : look;
  }
  return wear;
}
