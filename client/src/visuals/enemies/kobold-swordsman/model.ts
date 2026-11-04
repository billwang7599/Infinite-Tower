import {
  Color3, Mesh, MeshBuilder, TransformNode, type StandardMaterial,
} from "@babylonjs/core";
import type { EnemyDef, Entity, Vec3 } from "@infinite-tower/shared";
import { buildArm, type Arm, type BodyPart } from "../../battle/arm.js";
import { buildBlade } from "../../battle/blade.js";
import { loft, ROUNDNESS, type Section } from "../../battle/person/loft.js";
import type { ArenaScene } from "../../battle/scene.js";
import { enemyMaterial, lengthwise, limb as limbMesh } from "../shape.js";
import type { WeaponLook } from "../../battle/weapons.js";

/** `bulk` widens the body, not its height or arms (they're the fight's reach). */
export interface KoboldBuild { bulk: number; scales: string; cloth: string; plated: boolean }

export const SWORDSMAN_BUILD: KoboldBuild = { bulk: 1, scales: "#62804f", cloth: "#6e2f2a", plated: false };

export interface KoboldModel {
  /** Under the body's node; turned to the kobold's facing. */
  root: TransformNode;
  /** Child of root: lean, wobble, fall over. */
  model: TransformNode;
  hips: TransformNode;
  chest: TransformNode;
  torso: Mesh;
  head: TransformNode;
  tail: TransformNode;
  /** The sword is in swordArm's hand, along its +y. */
  swordArm: Arm;
  offArm: Arm;
  twoHanded: boolean;
  /** Hip pivots: left, right. */
  legs: [TransformNode, TransformNode];
  stars: TransformNode;
  materials: StandardMaterial[];
  /** Each material's own emissive color (same order), to return to after the hit flash. */
  baseEmissive: Color3[];
  gait: number;
  visualYaw: number;
}

/** A two-handed grip's off hand, this far (m) down the grip from the sword hand. */
export const OFF_GRIP_M = 0.2;

export function disposeKobold(v: KoboldModel): void {
  v.root.dispose();
  for (const m of v.materials) m.dispose();
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

// Leaning into the fight: each section sits further ahead the higher it is.
export const torsoSections = (b: number): Section[] => [
  { y: -0.06, x: 0.16 * b, z: 0.13 * b, dz: 0 }, { y: 0.1, x: 0.18 * b, z: 0.15 * b, dz: 0.02 },
  { y: 0.3, x: 0.23 * b, z: 0.19 * b, dz: 0.06 }, { y: 0.46, x: 0.24 * b, z: 0.17 * b, dz: 0.09 },
  { y: 0.56, x: 0.15 * b, z: 0.11 * b, dz: 0.11 },
];
export const bellySections = (b: number): Section[] => [
  { y: -0.02, x: 0.11 * b, z: 0.08 * b, dz: 0.06 }, { y: 0.2, x: 0.15 * b, z: 0.1 * b, dz: 0.1 * b },
  { y: 0.4, x: 0.14 * b, z: 0.08 * b, dz: 0.15 * b },
];
/** The share of the upper arm, from the shoulder, sunk in the torso as its joint. */
const SHOULDER_JOINT_SHARE = 0.3;

export function buildKobold(
  ctx: ArenaScene, e: Entity, parent: TransformNode, def: EnemyDef, yaw: number, weapon: WeaponLook | null,
  armReachM: number, build: KoboldBuild,
): KoboldModel {
  const { scene, sky } = ctx;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, hex: string): StandardMaterial => {
    const m = enemyMaterial(scene, name, hex);
    materials.push(m);
    return m;
  };
  const scales = mat("kobold-scales", build.scales), ridge = mat("kobold-ridge", "#3a4a33");
  const belly = mat("kobold-belly", "#a39a6a"), bone = mat("kobold-bone", "#d8cba4");
  const cloth = mat("kobold-cloth", build.cloth), leather = mat("kobold-leather", "#4a3424");
  const iron = mat("kobold-iron", "#6b6f75"), brass = mat("kobold-brass", "#b8913a");
  const eyes = mat("kobold-eyes", "#f2c84a"), slit = mat("kobold-slit", "#120d08");
  eyes.emissiveColor = new Color3(0.7, 0.5, 0.1);

  const parts: Mesh[] = [];
  const part = (m: Mesh, under: TransformNode, material: StandardMaterial): Mesh => {
    m.parent = under;
    m.material = material;
    m.isPickable = false;
    parts.push(m);
    return m;
  };
  const node = (name: string, under: TransformNode, x: number, y: number, z: number): TransformNode => {
    const n = new TransformNode(name, scene);
    n.parent = under;
    n.position.set(x, y, z);
    return n;
  };
  const ball = (name: string, under: TransformNode, material: StandardMaterial, at: Vec3, size: Vec3): Mesh => {
    const m = part(MeshBuilder.CreateSphere(name, { diameter: 1, segments: 8 }, scene), under, material);
    m.position.set(at.x, at.y, at.z);
    m.scaling.set(size.x, size.y, size.z);
    return m;
  };
  const limb = (
    name: string, under: TransformNode, material: StandardMaterial, from: Vec3, to: Vec3, dFrom: number, dTo: number,
  ): Mesh => part(limbMesh(scene, name, from, to, dFrom, dTo), under, material);
  const spike = (under: TransformNode, material: StandardMaterial, at: Vec3, dir: Vec3, lengthM: number, d: number) => {
    const tip = v(at.x + dir.x * lengthM, at.y + dir.y * lengthM, at.z + dir.z * lengthM);
    return limb("k-spike", under, material, at, tip, d, 0);
  };

  const b = build.bulk;
  const root = new TransformNode(`kobold-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius;
  const model = node(`kobold-model-${e}`, root, 0, 0, 0);
  const hips = node("k-hips", model, 0, 0.62, 0);
  const chest = node("k-chest", model, 0, 0.66, 0);

  const torso = part(loft(scene, "k-torso", torsoSections(b)), chest, scales);
  part(loft(scene, "k-belly", bellySections(b)), chest, belly);
  limb("k-strap", chest, leather, v(-0.2 * b, 0.06, 0.18 * b), v(0.2 * b, 0.48, 0.2), 0.05, 0.05);
  if (build.plated) {
    const plate = ball("k-plate", chest, iron, v(0, 0.3, 0.14), v(0.4 * b, 0.36, 0.22 * b));
    plate.rotation.x = 0.3;
  }
  for (const s of build.plated ? [-1, 1] : [1]) {
    ball("k-pauldron", chest, iron, v(s * 0.27 * b, 0.53, 0.1), v(0.22 * b, 0.13, 0.22 * b));
  }
  limb("k-neck", chest, scales, v(0, 0.46, 0.08), v(0, 0.64, 0.24), 0.17 * b, 0.13);
  for (const [y, z] of [[0.56, -0.02], [0.42, -0.14], [0.26, -0.2], [0.1, -0.2]] as const) {
    spike(chest, ridge, v(0, y, z), v(0, 0.45, -0.9), 0.1, 0.07);
  }

  const head = node("k-head", chest, 0, 0.68, 0.26);
  part(lengthwise(scene, "k-skull", [
    { z: -0.18, w: 0.13, h: 0.12, dy: 0.01 }, { z: -0.02, w: 0.17, h: 0.15, dy: 0.01 },
    { z: 0.14, w: 0.15, h: 0.11, dy: -0.03 }, { z: 0.32, w: 0.1, h: 0.07, dy: -0.05 },
    { z: 0.45, w: 0.06, h: 0.045, dy: -0.06 },
  ]), head, scales);
  part(lengthwise(scene, "k-jaw", [
    { z: 0.04, w: 0.11, h: 0.04, dy: -0.11 }, { z: 0.36, w: 0.06, h: 0.025, dy: -0.12 },
  ]), head, belly);
  for (const s of [-1, 1]) {
    for (const z of [0.26, 0.34]) spike(head, bone, v(s * 0.05, -0.09, z), v(0, -1, 0), 0.05, 0.025);
    ball("k-nostril", head, slit, v(s * 0.03, -0.02, 0.42), v(0.025, 0.02, 0.02));
    const eye = ball("k-eye", head, eyes, v(s * 0.12, 0.04, 0.1), v(0.075, 0.075, 0.075));
    const pupil = part(MeshBuilder.CreateBox("k-slit", { width: 0.14, height: 0.75, depth: 0.1 }, scene), eye, slit);
    pupil.position.set(s * 0.2, 0, 0.45);
    pupil.rotation.y = s * 0.42;
    const brow = part(MeshBuilder.CreateBox("k-brow", { width: 0.11, height: 0.03, depth: 0.09 }, scene), head, ridge);
    brow.position.set(s * 0.1, 0.1, 0.11);
    brow.rotation.z = s * 0.35;
    spike(head, bone, v(s * 0.1, 0.08, -0.1), v(s * 0.35, 0.25, -0.9), 0.24, 0.07);
  }
  for (const z of [0.12, 0.0, -0.13]) spike(head, ridge, v(0, 0.12, z), v(0, 0.6, -0.8), 0.08, 0.06);

  part(MeshBuilder.CreateCylinder("k-belt", { height: 0.07, diameter: 0.44 * b }, scene), hips, leather);
  const buckle = part(MeshBuilder.CreateBox("k-buckle", { width: 0.07, height: 0.06, depth: 0.02 }, scene), hips,
    brass);
  buckle.position.set(0, 0, 0.22 * b);
  for (const [z, tilt] of [[0.19, 0.12], [-0.17, -0.12]] as const) {
    const flap = part(MeshBuilder.CreateBox("k-loincloth", { width: 0.2 * b, height: 0.3, depth: 0.02 }, scene), hips,
      cloth);
    flap.position.set(0, -0.17, z * b);
    flap.rotation.x = tilt;
  }

  const tail = node("k-tail", hips, 0, -0.02, -0.18 * b);
  const tailAt = [v(0, 0, 0), v(0, -0.1, -0.3), v(0, -0.3, -0.56), v(0, -0.5, -0.76)];
  part(lengthwise(scene, "k-tail", [
    { z: -0.8, w: 0.005, h: 0.005, dy: -0.52 }, { z: -0.56, w: 0.04, h: 0.04, dy: -0.3 },
    { z: -0.3, w: 0.065, h: 0.065, dy: -0.1 }, { z: 0, w: 0.09 * b, h: 0.09 * b },
  ]), tail, scales);
  for (let i = 0; i < 3; i++) spike(tail, ridge, tailAt[i]!, v(0, 0.8, -0.6), 0.07, 0.05);

  // Digitigrade: thigh forward to the knee, shin back to a raised heel, then the long foot.
  const hip = (x: number): TransformNode => {
    const pivot = node("k-hip", hips, x, 0, 0);
    const knee = v(0, -0.24, 0.14), heel = v(0, -0.47, -0.07), toe = v(0, -0.6, 0.13);
    limb("k-thigh", pivot, scales, v(0, 0, 0), knee, 0.17 * b, 0.12 * b);
    limb("k-shin", pivot, scales, knee, heel, 0.1 * b, 0.08);
    limb("k-foot", pivot, ridge, heel, toe, 0.08, 0.07);
    for (const cx of [-0.03, 0, 0.03]) spike(pivot, bone, v(cx, -0.6, 0.15), v(0, -0.2, 1), 0.06, 0.025);
    return pivot;
  };
  const legs: KoboldModel["legs"] = [hip(-0.13 * b), hip(0.13 * b)];

  const body: BodyPart[] = [torsoSections(b), bellySections(b)].map((sections) => ({
    node: chest, sections, roundness: ROUNDNESS,
  }));
  const arm = (side: 1 | -1): Arm => buildArm(scene, part, model, chest, {
    side, shoulder: { x: side * 0.26 * b, y: 0.48, z: 0.1 }, reachM: armReachM, thicknessM: 0.1 * b,
    upper: scales, fore: scales, fist: ridge, body: { parts: body, jointShare: SHOULDER_JOINT_SHARE },
  });
  const swordArm = arm(1), offArm = arm(-1);
  const twoHanded = weapon?.twoHanded ?? false;
  if (weapon) {
    const steel = mat("kobold-steel", weapon.blade.color);
    parts.push(...buildBlade(scene, swordArm.hand, weapon, { grip: leather, guard: brass, steel }));
  }

  const stars = node("k-stars", model, 0, 1.72, 0);
  const starMat = mat("kobold-star", "#ffd84a");
  starMat.emissiveColor = new Color3(1.2, 1.0, 0.3);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const star = MeshBuilder.CreatePolyhedron("k-star", { type: 0, size: 0.07 }, scene);
    star.parent = stars;
    star.material = starMat;
    star.position.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
  }
  stars.setEnabled(false);

  for (const p of parts) sky.castShadows(p);

  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return {
    root, model, hips, chest, torso, head, tail, swordArm, offArm, twoHanded, legs, stars, materials, baseEmissive,
    gait: 0, visualYaw: yaw,
  };
}
