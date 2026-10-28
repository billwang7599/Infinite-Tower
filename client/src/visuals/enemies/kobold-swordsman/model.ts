/**
 * The Kobold Swordsman's 3D model, from primitives like the boar's: a small dog-headed fighter with a sword in its
 * right hand. Faces +z locally.
 */
import {
  Color3, Mesh, MeshBuilder, TransformNode, type StandardMaterial,
} from "@babylonjs/core";
import type { EnemyDef, Entity } from "@infinite-tower/shared";
import { colorMaterial } from "../../materials.js";
import type { ArenaScene } from "../../battle/scene.js";
import type { WeaponLook } from "../../battle/weapons.js";

export interface KoboldModel {
  /** Under the body's node; turned to the kobold's facing. */
  root: TransformNode;
  /** Child of root: lean, wobble, fall over. */
  model: TransformNode;
  /** The sword hand: the blade runs along its +y. */
  hand: TransformNode;
  /** Hip pivots: left, right. */
  legs: [TransformNode, TransformNode];
  stars: TransformNode;
  materials: StandardMaterial[];
  /** Each material's own emissive color (same order), to return to after the hit flash. */
  baseEmissive: Color3[];
  gait: number;
  visualYaw: number;
}

export function disposeKobold(v: KoboldModel): void {
  v.root.dispose();
  for (const m of v.materials) m.dispose();
}

export function buildKobold(
  ctx: ArenaScene, e: Entity, parent: TransformNode, def: EnemyDef, yaw: number, weapon: WeaponLook["blade"] | null,
): KoboldModel {
  const { scene, sunShadows } = ctx;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, hex: string): StandardMaterial => {
    const m = colorMaterial(scene, name, Color3.FromHexString(hex), new Color3(0.05, 0.05, 0.05));
    materials.push(m);
    return m;
  };
  const fur = mat("kobold-fur", "#8a6a4a"), dark = mat("kobold-dark", "#4a3626");
  const cloth = mat("kobold-cloth", "#6e2f2a");
  const brass = mat("kobold-brass", "#b8913a"), eyes = mat("kobold-eyes", "#f2c84a");
  eyes.emissiveColor = new Color3(0.6, 0.45, 0.1);

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

  const root = new TransformNode(`kobold-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius;
  const model = node(`kobold-model-${e}`, root, 0, 0, 0);

  const torso = part(MeshBuilder.CreateCylinder("k-torso", { height: 0.62, diameterTop: 0.42, diameterBottom: 0.5 },
    scene), model, cloth);
  torso.position.y = 0.95;
  const belt = part(MeshBuilder.CreateCylinder("k-belt", { height: 0.08, diameter: 0.52 }, scene), model, dark);
  belt.position.y = 0.7;
  const head = node("k-head", model, 0, 1.42, 0.02);
  const skull = part(MeshBuilder.CreateSphere("k-skull", { diameter: 0.42, segments: 10 }, scene), head, fur);
  skull.scaling.set(1, 0.95, 1.05);
  const snout = part(MeshBuilder.CreateCylinder("k-snout", { height: 0.3, diameterTop: 0.12, diameterBottom: 0.22 },
    scene), head, fur);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.06, 0.26);
  const nose = part(MeshBuilder.CreateSphere("k-nose", { diameter: 0.07, segments: 6 }, scene), head, dark);
  nose.position.set(0, -0.04, 0.41);
  for (const s of [-1, 1]) {
    const ear = part(MeshBuilder.CreateCylinder("k-ear", { height: 0.26, diameterTop: 0, diameterBottom: 0.13,
      tessellation: 6 }, scene), head, dark);
    ear.position.set(s * 0.13, 0.22, -0.03);
    ear.rotation.z = -s * 0.35;
    const eye = part(MeshBuilder.CreateSphere("k-eye", { diameter: 0.06, segments: 6 }, scene), head, eyes);
    eye.position.set(s * 0.1, 0.04, 0.17);
    // The off arm hangs; the sword arm is the hand below.
    if (s < 0) {
      const arm = part(MeshBuilder.CreateBox("k-arm", { width: 0.12, height: 0.5, depth: 0.12 }, scene), model, fur);
      arm.position.set(-0.3, 0.95, 0);
      arm.rotation.z = -0.15;
    }
  }
  const tail = part(MeshBuilder.CreateCylinder("k-tail", { height: 0.5, diameterTop: 0.03, diameterBottom: 0.09 },
    scene), model, fur);
  tail.position.set(0, 0.7, -0.32);
  tail.rotation.x = -1.0;

  const hip = (x: number): TransformNode => {
    const pivot = node("k-hip", model, x, 0.66, 0);
    const leg = part(MeshBuilder.CreateBox("k-leg", { width: 0.14, height: 0.6, depth: 0.16 }, scene), pivot, dark);
    leg.position.y = -0.3;
    return pivot;
  };
  const legs: KoboldModel["legs"] = [hip(-0.13), hip(0.13)];

  // The sword hand, held in front of its right shoulder; the arm reaches from the shoulder to it.
  const hand = node("k-hand", model, 0.22, 1.08, 0.28);
  if (weapon) {
    const grip = part(MeshBuilder.CreateBox("k-grip", { width: 0.05, height: 0.2, depth: 0.05 }, scene), hand, dark);
    grip.position.y = 0;
    const guardBar = part(MeshBuilder.CreateBox("k-guard", { width: 0.24, height: 0.04, depth: 0.06 }, scene), hand,
      brass);
    guardBar.position.y = 0.12;
    const steel = mat("kobold-steel", weapon.color);
    const blade = part(MeshBuilder.CreateBox("k-blade", { width: weapon.widthM, height: weapon.lengthM, depth: 0.02 },
      scene), hand, steel);
    blade.position.y = 0.14 + weapon.lengthM / 2;
  }
  const fist = part(MeshBuilder.CreateSphere("k-fist", { diameter: 0.13, segments: 6 }, scene), hand, fur);
  fist.position.y = -0.02;

  const stars = node("k-stars", model, 0, 1.85, 0);
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

  for (const p of parts) sunShadows.addShadowCaster(p);

  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return { root, model, hand, legs, stars, materials, baseEmissive, gait: 0, visualYaw: yaw };
}
