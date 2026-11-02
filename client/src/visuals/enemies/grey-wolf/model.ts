import { Color3, MeshBuilder, TransformNode, type Mesh, type StandardMaterial } from "@babylonjs/core";
import type { EnemyDef, Entity } from "@infinite-tower/shared";
import { colorMaterial } from "../../materials.js";
import type { ArenaScene } from "../../battle/scene.js";

export interface WolfModel {
  root: TransformNode;
  model: TransformNode;
  head: TransformNode;
  jaw: TransformNode;
  tail: TransformNode;
  /** Hip pivots: front-left, front-right, back-left, back-right. */
  legs: [TransformNode, TransformNode, TransformNode, TransformNode];
  materials: StandardMaterial[];
  baseEmissive: Color3[];
  eyes: StandardMaterial;
  gait: number;
  ground: number;
  visualYaw: number;
  clock: number;
}

export function disposeWolf(v: WolfModel): void {
  v.root.dispose();
  for (const m of v.materials) m.dispose();
}

// Faces +z locally.
export function buildWolf(ctx: ArenaScene, e: Entity, parent: TransformNode, def: EnemyDef, yaw: number): WolfModel {
  const { scene, sky } = ctx;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, hex: string): StandardMaterial => {
    const m = colorMaterial(scene, name, Color3.FromHexString(hex), new Color3(0.05, 0.05, 0.05));
    materials.push(m);
    return m;
  };
  const fur = mat("wolf-fur", "#7a7d84");
  const dark = mat("wolf-dark", "#45474e");
  const pale = mat("wolf-pale", "#b8b3a8");
  const nose = mat("wolf-nose", "#17171b");
  const teeth = mat("wolf-teeth", "#ece6d6");
  const eyes = mat("wolf-eyes", "#d9a83a");
  eyes.emissiveColor = new Color3(0.35, 0.25, 0.05);

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

  const root = new TransformNode(`wolf-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius;
  const model = node(`wolf-model-${e}`, root, 0, 0, 0);

  const body = part(MeshBuilder.CreateSphere("w-body", { diameter: 1, segments: 8 }, scene), model, fur);
  body.scaling.set(0.62, 0.62, 1.45);
  body.position.set(0, 0.8, -0.05);
  const chest = part(MeshBuilder.CreateSphere("w-chest", { diameter: 1, segments: 8 }, scene), model, pale);
  chest.scaling.set(0.55, 0.62, 0.6);
  chest.position.set(0, 0.76, 0.42);
  const ruff = part(MeshBuilder.CreateBox("w-ruff", { width: 0.2, height: 0.18, depth: 1.1 }, scene), model, dark);
  ruff.position.set(0, 1.08, 0.05);

  const head = node("w-head", model, 0, 1.0, 0.68);
  const skull = part(MeshBuilder.CreateBox("w-skull", { width: 0.42, height: 0.36, depth: 0.42 }, scene), head, fur);
  skull.position.set(0, 0.04, 0.12);
  const snout = part(MeshBuilder.CreateBox("w-snout", { width: 0.22, height: 0.16, depth: 0.36 }, scene), head, fur);
  snout.position.set(0, 0.0, 0.48);
  const tip = part(MeshBuilder.CreateBox("w-nose", { width: 0.1, height: 0.08, depth: 0.06 }, scene), head, nose);
  tip.position.set(0, 0.06, 0.67);
  const jaw = node("w-jaw", head, 0, -0.08, 0.32);
  const lower = part(MeshBuilder.CreateBox("w-jaw", { width: 0.18, height: 0.07, depth: 0.32 }, scene), jaw, pale);
  lower.position.set(0, -0.02, 0.15);
  for (const s of [-1, 1]) {
    const ear = part(MeshBuilder.CreateCylinder("w-ear", { height: 0.2, diameterTop: 0, diameterBottom: 0.13,
      tessellation: 4 }, scene), head, dark);
    ear.position.set(s * 0.13, 0.3, 0.04);
    ear.rotation.z = -s * 0.2;
    const eye = part(MeshBuilder.CreateSphere("w-eye", { diameter: 0.07, segments: 4 }, scene), head, eyes);
    eye.position.set(s * 0.13, 0.1, 0.33);
    const fang = part(MeshBuilder.CreateCylinder("w-fang", { height: 0.08, diameterTop: 0, diameterBottom: 0.035,
      tessellation: 4 }, scene), head, teeth);
    fang.position.set(s * 0.07, -0.11, 0.6);
    fang.rotation.x = Math.PI;
  }

  const tail = node("w-tail", model, 0, 0.95, -0.7);
  const brush = part(MeshBuilder.CreateCylinder("w-brush", { height: 0.6, diameterTop: 0.08, diameterBottom: 0.2,
    tessellation: 6 }, scene), tail, dark);
  brush.position.y = -0.3;

  const hip = (x: number, z: number): TransformNode => {
    const pivot = node("w-hip", model, x, 0.62, z);
    const leg = part(MeshBuilder.CreateBox("w-leg", { width: 0.13, height: 0.6, depth: 0.15 }, scene), pivot, fur);
    leg.position.y = -0.3;
    const paw = part(MeshBuilder.CreateBox("w-paw", { width: 0.15, height: 0.07, depth: 0.2 }, scene), pivot, dark);
    paw.position.set(0, -0.6, 0.03);
    return pivot;
  };
  const legs: WolfModel["legs"] = [hip(-0.2, 0.45), hip(0.2, 0.45), hip(-0.2, -0.55), hip(0.2, -0.55)];

  for (const p of parts) sky.castShadows(p);
  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return {
    root, model, head, jaw, tail, legs, materials, baseEmissive, eyes, gait: 0, ground: 0, visualYaw: yaw, clock: 0,
  };
}
