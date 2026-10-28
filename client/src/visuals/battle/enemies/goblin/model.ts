import { Color3, MeshBuilder, TransformNode, type Mesh, type StandardMaterial } from "@babylonjs/core";
import type { EnemyDef, Entity } from "@infinite-tower/shared";
import { colorMaterial } from "../../../materials.js";
import type { ArenaScene } from "../../scene.js";

export interface GoblinModel {
  root: TransformNode;
  model: TransformNode;
  hand: TransformNode;
  legs: [TransformNode, TransformNode];
  stars: TransformNode;
  orb: StandardMaterial;
  materials: StandardMaterial[];
  baseEmissive: Color3[];
  gait: number;
  visualYaw: number;
}

export function disposeGoblin(v: GoblinModel): void {
  v.root.dispose();
  for (const m of v.materials) m.dispose();
}

export function buildGoblin(
  ctx: ArenaScene, e: Entity, parent: TransformNode, def: EnemyDef, yaw: number,
): GoblinModel {
  const { scene, sunShadows } = ctx;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, hex: string): StandardMaterial => {
    const m = colorMaterial(scene, name, Color3.FromHexString(hex), new Color3(0.04, 0.04, 0.04));
    materials.push(m);
    return m;
  };
  const skin = mat("goblin-skin", "#5f8a3a"), robe = mat("goblin-robe", "#3b2a52");
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
    const leg = part(MeshBuilder.CreateBox("g-leg", { width: 0.1, height: 0.3, depth: 0.12 }, scene), pivot, skin);
    leg.position.y = -0.15;
    return pivot;
  };
  const legs: GoblinModel["legs"] = [hip(-0.09), hip(0.09)];

  const gown = part(MeshBuilder.CreateCylinder("g-robe", { height: 0.6, diameterTop: 0.26, diameterBottom: 0.56,
    tessellation: 10 }, scene), model, robe);
  gown.position.y = 0.48;
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
  const hood = part(MeshBuilder.CreateCylinder("g-hood", { height: 0.34, diameterTop: 0, diameterBottom: 0.4,
    tessellation: 10 }, scene), head, robe);
  hood.position.set(0, 0.17, -0.04);
  hood.rotation.x = -0.35;
  for (const s of [-1, 1]) {
    const ear = part(MeshBuilder.CreateCylinder("g-ear", { height: 0.3, diameterTop: 0, diameterBottom: 0.1,
      tessellation: 6 }, scene), head, skin);
    ear.position.set(s * 0.24, 0.03, -0.02);
    ear.rotation.z = -s * 1.25;
    const eye = part(MeshBuilder.CreateSphere("g-eye", { diameter: 0.06, segments: 6 }, scene), head, eyes);
    eye.position.set(s * 0.08, 0.03, 0.15);
    if (s < 0) {
      const arm = part(MeshBuilder.CreateBox("g-arm", { width: 0.09, height: 0.34, depth: 0.09 }, scene), model, robe);
      arm.position.set(-0.2, 0.58, 0.02);
      arm.rotation.z = -0.2;
    }
  }

  const hand = node("g-hand", model, 0.2, 0.62, 0.22);
  part(MeshBuilder.CreateSphere("g-fist", { diameter: 0.1, segments: 6 }, scene), hand, skin);
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

  for (const p of parts) sunShadows.addShadowCaster(p);
  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return { root, model, hand, legs, stars, orb, materials, baseEmissive, gait: 0, visualYaw: yaw };
}
