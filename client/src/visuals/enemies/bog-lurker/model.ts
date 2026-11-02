import { Color3, MeshBuilder, TransformNode, type Mesh, type StandardMaterial } from "@babylonjs/core";
import type { EnemyDef, Entity } from "@infinite-tower/shared";
import { colorMaterial } from "../../materials.js";
import type { ArenaScene } from "../../battle/scene.js";

export interface LurkerModel {
  root: TransformNode;
  model: TransformNode;
  head: TransformNode;
  jaw: TransformNode;
  tail: TransformNode;
  arms: [TransformNode, TransformNode];
  materials: StandardMaterial[];
  baseEmissive: Color3[];
  eyes: StandardMaterial;
  gait: number;
  visualYaw: number;
  spin: number;
  clock: number;
}

export function disposeLurker(v: LurkerModel): void {
  v.root.dispose();
  for (const m of v.materials) m.dispose();
}

// Faces +z locally.
export function buildLurker(
  ctx: ArenaScene, e: Entity, parent: TransformNode, def: EnemyDef, yaw: number,
): LurkerModel {
  const { scene, sky } = ctx;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, hex: string): StandardMaterial => {
    const m = colorMaterial(scene, name, Color3.FromHexString(hex), new Color3(0.08, 0.08, 0.06));
    materials.push(m);
    return m;
  };
  const hide = mat("lurker-hide", "#3d4a2c");
  const belly = mat("lurker-belly", "#7a7550");
  const moss = mat("lurker-moss", "#5a7a2c");
  const dark = mat("lurker-dark", "#20261a");
  const teeth = mat("lurker-teeth", "#d6cfa8");
  const eyes = mat("lurker-eyes", "#c8e05a");
  eyes.emissiveColor = new Color3(0.2, 0.28, 0.05);

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
  const sphere = (name: string, under: TransformNode, material: StandardMaterial) =>
    part(MeshBuilder.CreateSphere(name, { diameter: 1, segments: 10 }, scene), under, material);
  const box = (name: string, under: TransformNode, material: StandardMaterial, w: number, h: number, d: number) =>
    part(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), under, material);

  const root = new TransformNode(`lurker-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius;
  const model = node(`lurker-model-${e}`, root, 0, 0, 0);

  const body = sphere("l-body", model, hide);
  body.scaling.set(1.75, 0.95, 2.05);
  body.position.set(0, 0.8, 0);
  const under = sphere("l-belly", model, belly);
  under.scaling.set(1.45, 0.6, 1.7);
  under.position.set(0, 0.55, 0.1);
  for (const [x, z, size] of [[0, 0.55, 0.5], [0.3, 0, 0.42], [-0.28, -0.35, 0.46], [0.05, -0.75, 0.36]] as const) {
    const lump = sphere("l-moss", model, moss);
    lump.scaling.set(size, size * 0.55, size);
    lump.position.set(x, 1.25, z);
  }

  const head = node("l-head", model, 0, 0.95, 1.05);
  const skull = box("l-skull", head, hide, 1.05, 0.38, 0.75);
  skull.position.set(0, 0.05, 0.25);
  const brow = box("l-brow", head, dark, 0.9, 0.12, 0.25);
  brow.position.set(0, 0.28, 0.05);
  const jaw = node("l-jaw", head, 0, -0.12, 0);
  const lower = box("l-jaw", jaw, belly, 0.95, 0.16, 0.7);
  lower.position.set(0, -0.06, 0.3);
  for (const s of [-1, 1]) {
    const eye = sphere("l-eye", head, eyes);
    eye.scaling.setAll(0.17);
    eye.position.set(s * 0.32, 0.32, 0.12);
    for (const x of [0.12, 0.32]) {
      const tooth = part(MeshBuilder.CreateCylinder("l-tooth", { height: 0.12, diameterTop: 0, diameterBottom: 0.06,
        tessellation: 4 }, scene), head, teeth);
      tooth.position.set(s * x, -0.17, 0.55);
      tooth.rotation.x = Math.PI;
    }
  }

  const tail = node("l-tail", model, 0, 0.7, -0.95);
  const base = part(MeshBuilder.CreateCylinder("l-tail", { height: 1.1, diameterTop: 0.25, diameterBottom: 0.6,
    tessellation: 8 }, scene), tail, hide);
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.15, -0.5);
  const tip = part(MeshBuilder.CreateCylinder("l-tip", { height: 0.8, diameterTop: 0, diameterBottom: 0.25,
    tessellation: 6 }, scene), tail, dark);
  tip.rotation.x = -Math.PI / 2;
  tip.position.set(0, -0.25, -1.45);

  const shoulder = (s: number): TransformNode => {
    const pivot = node("l-shoulder", model, s * 0.78, 0.95, 0.55);
    const arm = box("l-arm", pivot, hide, 0.32, 0.85, 0.34);
    arm.position.y = -0.4;
    const claws = box("l-claws", pivot, dark, 0.42, 0.14, 0.45);
    claws.position.set(0, -0.84, 0.08);
    return pivot;
  };
  for (const s of [-1, 1]) {
    const hind = box("l-hind", model, hide, 0.34, 0.5, 0.5);
    hind.position.set(s * 0.72, 0.28, -0.55);
  }

  for (const p of parts) sky.castShadows(p);
  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return {
    root, model, head, jaw, tail, arms: [shoulder(-1), shoulder(1)], materials, baseEmissive, eyes, gait: 0,
    visualYaw: yaw, spin: 0, clock: 0,
  };
}
