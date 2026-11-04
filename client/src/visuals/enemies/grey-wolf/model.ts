import { Color3, MeshBuilder, TransformNode, type Mesh, type StandardMaterial } from "@babylonjs/core";
import type { EnemyDef, Entity, Vec3 } from "@infinite-tower/shared";
import { loft } from "../../battle/person/loft.js";
import type { ArenaScene } from "../../battle/scene.js";
import { enemyMaterial, lengthwise, limb } from "../shape.js";

export interface WolfModel {
  root: TransformNode;
  model: TransformNode;
  trunk: Mesh;
  head: TransformNode;
  ears: TransformNode[];
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
    const m = enemyMaterial(scene, name, hex);
    materials.push(m);
    return m;
  };
  const fur = mat("wolf-fur", "#5d5f66");
  const dark = mat("wolf-dark", "#37383e");
  const pale = mat("wolf-pale", "#8f8678");
  const nose = mat("wolf-nose", "#202024");
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
  const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

  const root = new TransformNode(`wolf-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius;
  const model = node(`wolf-model-${e}`, root, 0, 0, 0);

  const trunk = part(lengthwise(scene, "w-body", [
    { z: -0.74, w: 0.12, h: 0.12, dy: 0.04 }, { z: -0.62, w: 0.24, h: 0.23, dy: 0.02 },
    { z: -0.32, w: 0.23, h: 0.2, dy: 0.05 }, { z: 0.05, w: 0.27, h: 0.29, dy: 0 },
    { z: 0.36, w: 0.29, h: 0.35, dy: -0.02 }, { z: 0.56, w: 0.24, h: 0.3, dy: 0.05 },
    { z: 0.7, w: 0.14, h: 0.18, dy: 0.14 },
  ]), model, fur);
  trunk.position.y = 0.82;
  const bib = part(lengthwise(scene, "w-chest", [
    { z: 0.1, w: 0.16, h: 0.14, dy: -0.18 }, { z: 0.4, w: 0.22, h: 0.22, dy: -0.12 },
    { z: 0.62, w: 0.16, h: 0.2, dy: 0.02 },
  ]), trunk, pale);
  bib.position.y = 0.01;
  const ruff = part(lengthwise(scene, "w-ruff", [
    { z: -0.1, w: 0.12, h: 0.06, dy: 0.24 }, { z: 0.35, w: 0.31, h: 0.16, dy: 0.28 },
    { z: 0.72, w: 0.24, h: 0.2, dy: 0.26 },
  ]), trunk, dark);
  ruff.position.y = 0;

  const head = node("w-head", model, 0, 1.0, 0.68);
  part(lengthwise(scene, "w-skull", [
    { z: -0.1, w: 0.17, h: 0.15, dy: 0.04 }, { z: 0.14, w: 0.2, h: 0.18, dy: 0.05 },
    { z: 0.32, w: 0.14, h: 0.12, dy: 0.02 }, { z: 0.5, w: 0.1, h: 0.08, dy: 0 }, { z: 0.68, w: 0.06, h: 0.06 },
  ]), head, fur);
  const tip = part(MeshBuilder.CreateSphere("w-nose", { diameter: 0.09, segments: 5 }, scene), head, nose);
  tip.position.set(0, 0.04, 0.68);
  const jaw = node("w-jaw", head, 0, -0.08, 0.32);
  part(lengthwise(scene, "w-jaw", [{ z: 0, w: 0.09, h: 0.04 }, { z: 0.32, w: 0.05, h: 0.03 }]), jaw, pale);
  const ears: TransformNode[] = [];
  for (const s of [-1, 1]) {
    const ear = node("w-ear", head, s * 0.1, 0.2, 0.04);
    const flap = part(limb(scene, "w-ear", v(0, 0, 0), v(s * 0.05, 0.2, -0.03), 0.14, 0, 4), ear, dark);
    flap.scaling.z = 0.6;
    ears.push(ear);
    const eye = part(MeshBuilder.CreateSphere("w-eye", { diameter: 0.07, segments: 4 }, scene), head, eyes);
    eye.position.set(s * 0.12, 0.1, 0.3);
    const fang = part(limb(scene, "w-fang", v(0, 0, 0), v(0, -0.08, 0), 0.035, 0, 4), head, teeth);
    fang.position.set(s * 0.05, -0.11, 0.58);
  }

  const tail = node("w-tail", model, 0, 0.95, -0.7);
  part(loft(scene, "w-brush", [
    { y: -0.66, x: 0.03, z: 0.03 }, { y: -0.52, x: 0.1, z: 0.09 }, { y: -0.26, x: 0.11, z: 0.1 },
    { y: 0, x: 0.06, z: 0.06 },
  ], 2), tail, dark);

  const hip = (x: number, z: number, front: boolean): TransformNode => {
    const pivot = node("w-hip", model, x, 0.62, z);
    const knee = front ? v(0, -0.3, 0.02) : v(0, -0.26, 0.08), ankle = front ? v(0, -0.54, 0) : v(0, -0.46, -0.08);
    part(limb(scene, "w-thigh", v(0, 0.12, 0), knee, front ? 0.2 : 0.27, 0.12), pivot, fur);
    part(limb(scene, "w-shin", knee, ankle, 0.11, 0.085), pivot, fur);
    part(limb(scene, "w-pastern", ankle, v(0, -0.58, 0.02), 0.085, 0.085), pivot, fur);
    const paw = part(MeshBuilder.CreateSphere("w-paw", { diameter: 0.16, segments: 5 }, scene), pivot, dark);
    paw.scaling.set(1, 0.55, 1.35);
    paw.position.set(0, -0.6, 0.04);
    return pivot;
  };
  const legs: WolfModel["legs"] = [hip(-0.17, 0.45, true), hip(0.17, 0.45, true), hip(-0.17, -0.55, false),
    hip(0.17, -0.55, false)];

  for (const p of parts) sky.castShadows(p);
  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return {
    root, model, trunk, head, jaw, ears, tail, legs, materials, baseEmissive, eyes, gait: 0, ground: 0, visualYaw: yaw,
    clock: 0,
  };
}
