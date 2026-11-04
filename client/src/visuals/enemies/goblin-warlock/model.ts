import { Color3, MeshBuilder, TransformNode, type Mesh, type StandardMaterial } from "@babylonjs/core";
import type { EnemyDef, Entity } from "@infinite-tower/shared";
import { buildArm, type Arm } from "../../battle/arm.js";
import { loft, type Section } from "../../battle/person/loft.js";
import type { ArenaScene } from "../../battle/scene.js";
import { enemyMaterial, lengthwise, limb } from "../shape.js";

const ARM_REACH_M = 0.5;
export const GOWN: Section[] = [
  { y: 0.17, x: 0.29, z: 0.27, dz: -0.02 }, { y: 0.3, x: 0.24, z: 0.22, dz: -0.01 },
  { y: 0.55, x: 0.17, z: 0.15, dz: 0 }, { y: 0.74, x: 0.19, z: 0.16, dz: -0.02 },
  { y: 0.84, x: 0.11, z: 0.11, dz: 0 },
];
export const GOWN_ROUNDNESS = 2.1;
/** Of the upper arm from the shoulder: still in the gown, where the sleeve comes out. */
const SLEEVE_SHARE = 0.4;

export interface GoblinModel {
  root: TransformNode;
  model: TransformNode;
  gown: Mesh;
  head: TransformNode;
  ears: TransformNode[];
  staffArm: Arm;
  offArm: Arm;
  legs: [TransformNode, TransformNode];
  stars: TransformNode;
  orb: StandardMaterial;
  materials: StandardMaterial[];
  baseEmissive: Color3[];
  gait: number;
  visualYaw: number;
  clock: number;
}

export function disposeGoblin(v: GoblinModel): void {
  v.root.dispose();
  for (const m of v.materials) m.dispose();
}

export function buildGoblin(
  ctx: ArenaScene, e: Entity, parent: TransformNode, def: EnemyDef, yaw: number,
): GoblinModel {
  const { scene, sky } = ctx;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, hex: string): StandardMaterial => {
    const m = enemyMaterial(scene, name, hex, 0.04);
    materials.push(m);
    return m;
  };
  const skin = mat("goblin-skin", "#6d9a42"), robe = mat("goblin-robe", "#4a3766");
  const trim = mat("goblin-trim", "#8a6a2a");
  const wood = mat("goblin-wood", "#5a3c22"), eyes = mat("goblin-eyes", "#ffb03a");
  eyes.emissiveColor = new Color3(0.9, 0.5, 0.1);
  const orb = mat("goblin-orb", "#ff8a3a");

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

  const root = new TransformNode(`goblin-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius;
  const model = node(`goblin-model-${e}`, root, 0, 0, 0);

  const hip = (x: number): TransformNode => {
    const pivot = node("g-hip", model, x, 0.3, 0);
    part(limb(scene, "g-leg", { x: 0, y: 0, z: 0 }, { x: 0, y: -0.27, z: 0 }, 0.09, 0.07, 6), pivot, skin);
    const foot = part(MeshBuilder.CreateSphere("g-foot", { diameter: 0.12, segments: 5 }, scene), pivot, wood);
    foot.scaling.set(0.9, 0.5, 1.6);
    foot.position.set(0, -0.28, 0.05);
    return pivot;
  };
  const legs: GoblinModel["legs"] = [hip(-0.09), hip(0.09)];

  const gown = part(loft(scene, "g-robe", GOWN, GOWN_ROUNDNESS), model, robe);
  part(loft(scene, "g-sash", [{ y: 0.47, x: 0.2, z: 0.18 }, { y: 0.53, x: 0.19, z: 0.17 }]), model, trim);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const tatter = part(limb(scene, "g-tatter", { x: 0, y: 0, z: 0 }, { x: 0, y: -0.12, z: 0 }, 0.12, 0, 3), model,
      robe);
    tatter.position.set(Math.sin(a) * 0.25, 0.16, Math.cos(a) * 0.23);
  }
  const hem = part(MeshBuilder.CreateTorus("g-hem", { diameter: 0.54, thickness: 0.04, tessellation: 16 }, scene),
    model, trim);
  hem.position.y = 0.2;

  const head = node("g-head", model, 0, 0.92, 0.03);
  const skull = part(MeshBuilder.CreateSphere("g-skull", { diameter: 0.36, segments: 10 }, scene), head, skin);
  skull.scaling.set(1.05, 0.95, 1);
  const nose = part(MeshBuilder.CreateCylinder("g-nose", { height: 0.16, diameterTop: 0, diameterBottom: 0.08,
    tessellation: 6 }, scene), head, skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.03, 0.22);
  part(lengthwise(scene, "g-hood", [
    { z: -0.42, w: 0.01, h: 0.01, dy: -0.02 }, { z: -0.3, w: 0.07, h: 0.06, dy: 0.12 },
    { z: -0.12, w: 0.18, h: 0.15, dy: 0.12 }, { z: 0.05, w: 0.21, h: 0.2, dy: 0.06 },
    { z: 0.13, w: 0.2, h: 0.2, dy: 0.04 },
  ]), head, robe);
  const ears: TransformNode[] = [];
  for (const s of [-1, 1]) {
    const ear = node("g-ear", head, s * 0.14, 0.03, -0.02);
    const flap = part(MeshBuilder.CreateCylinder("g-ear", { height: 0.3, diameterTop: 0, diameterBottom: 0.1,
      tessellation: 6 }, scene), ear, skin);
    flap.position.x = s * 0.12;
    flap.rotation.z = -s * 1.25;
    ears.push(ear);
    const eye = part(MeshBuilder.CreateSphere("g-eye", { diameter: 0.06, segments: 6 }, scene), head, eyes);
    eye.position.set(s * 0.08, 0.03, 0.15);
  }

  const arm = (side: 1 | -1): Arm => buildArm(scene, part, model, null, {
    side, shoulder: { x: side * 0.15, y: 0.74, z: 0 }, reachM: ARM_REACH_M, thicknessM: 0.085,
    upper: robe, fore: robe, fist: skin,
    body: { parts: [{ node: model, sections: GOWN, roundness: GOWN_ROUNDNESS }], jointShare: SLEEVE_SHARE },
  });
  const staffArm = arm(1), offArm = arm(-1), hand = staffArm.hand;
  const staff = part(MeshBuilder.CreateCylinder("g-staff", { height: 1.3, diameter: 0.045, tessellation: 6 }, scene),
    hand, wood);
  staff.position.y = 0.25;
  const crook = part(MeshBuilder.CreateTorus("g-crook", { diameter: 0.16, thickness: 0.035, tessellation: 12 }, scene),
    hand, wood);
  crook.position.y = 0.92;
  crook.rotation.x = Math.PI / 2;
  const gem = part(MeshBuilder.CreateSphere("g-orb", { diameter: 0.13, segments: 8 }, scene), hand, orb);
  gem.position.y = 0.92;

  const stars = node("g-stars", model, 0, 1.3, 0);
  const starMat = mat("goblin-star", "#ffd84a");
  starMat.emissiveColor = new Color3(1.2, 1.0, 0.3);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const star = MeshBuilder.CreatePolyhedron("g-star", { type: 0, size: 0.06 }, scene);
    star.parent = stars;
    star.material = starMat;
    star.position.set(Math.sin(a) * 0.26, 0, Math.cos(a) * 0.26);
  }
  stars.setEnabled(false);

  for (const p of parts) sky.castShadows(p);
  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return {
    root, model, gown, head, ears, staffArm, offArm, legs, stars, orb, materials, baseEmissive, gait: 0, visualYaw: yaw,
    clock: 0,
  };
}
