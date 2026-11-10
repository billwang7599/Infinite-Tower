import { Color3, Mesh, MeshBuilder, TransformNode, type StandardMaterial } from "@babylonjs/core";
import type { EnemyDef, Entity, Vec3 } from "@infinite-tower/shared";
import type { ArenaScene } from "../../battle/scene.js";
import { enemyMaterial, lengthwise, limb } from "../shape.js";

export interface LurkerModel {
  root: TransformNode;
  model: TransformNode;
  trunk: Mesh;
  head: TransformNode;
  jaw: TransformNode;
  tail: TransformNode;
  arms: [TransformNode, TransformNode];
  materials: StandardMaterial[];
  baseEmissive: Color3[];
  eyes: StandardMaterial;
  gait: number;
  pace: number;
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
    const m = enemyMaterial(scene, name, hex, 0.08);
    materials.push(m);
    return m;
  };
  const hide = mat("lurker-hide", "#4d5c38");
  const belly = mat("lurker-belly", "#8a8459");
  const moss = mat("lurker-moss", "#668a32");
  const dark = mat("lurker-dark", "#2e3624");
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
  const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

  const root = new TransformNode(`lurker-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius;
  const model = node(`lurker-model-${e}`, root, 0, 0, 0);

  const trunk = part(lengthwise(scene, "l-body", [
    { z: -1.05, w: 0.35, h: 0.2, dy: -0.12 }, { z: -0.85, w: 0.72, h: 0.38, dy: -0.06 },
    { z: -0.3, w: 0.86, h: 0.46, dy: 0 }, { z: 0.3, w: 0.9, h: 0.5, dy: 0.04 }, { z: 0.8, w: 0.75, h: 0.42, dy: 0.08 },
    { z: 1.08, w: 0.5, h: 0.28, dy: 0.1 },
  ], 2.1), model, hide);
  trunk.position.y = 0.8;
  const under = part(lengthwise(scene, "l-belly", [
    { z: -0.75, w: 0.5, h: 0.14 }, { z: 0, w: 0.74, h: 0.2 }, { z: 0.8, w: 0.55, h: 0.16 },
  ]), trunk, belly);
  under.position.y = -0.3;
  for (const [x, z, size] of [[0, 0.55, 0.5], [0.3, 0, 0.42], [-0.28, -0.35, 0.46], [0.05, -0.75, 0.36]] as const) {
    const lump = sphere("l-moss", trunk, moss);
    lump.scaling.set(size, size * 0.55, size);
    lump.position.set(x, 0.45, z);
  }
  part(Mesh.MergeMeshes(Array.from({ length: 6 }, (_, i) => {
    const z = -0.7 + i * 0.28, y = 0.5 + 0.04 * Math.sin(i);
    return limb(scene, "l-ridge", v(0, y, z), v(0, y + 0.16, z - 0.1), 0.16, 0, 4);
  }), true)!, trunk, dark);

  const head = node("l-head", model, 0, 0.95, 1.05);
  part(lengthwise(scene, "l-skull", [
    { z: -0.15, w: 0.45, h: 0.22, dy: 0.08 }, { z: 0.15, w: 0.53, h: 0.22, dy: 0.08 },
    { z: 0.5, w: 0.46, h: 0.15, dy: 0.04 }, { z: 0.66, w: 0.32, h: 0.1, dy: 0.02 },
  ], 2.6), head, hide);
  const brow = part(lengthwise(scene, "l-brow", [{ z: -0.05, w: 0.42, h: 0.07 }, { z: 0.18, w: 0.36, h: 0.05 }]),
    head, dark);
  brow.position.y = 0.28;
  const jaw = node("l-jaw", head, 0, -0.12, 0);
  part(lengthwise(scene, "l-jaw", [
    { z: -0.05, w: 0.46, h: 0.1, dy: -0.04 }, { z: 0.45, w: 0.42, h: 0.08, dy: -0.06 },
    { z: 0.64, w: 0.3, h: 0.06, dy: -0.06 },
  ], 2.6), jaw, belly);
  for (const s of [-1, 1]) {
    const eye = sphere("l-eye", head, eyes);
    eye.scaling.setAll(0.17);
    eye.position.set(s * 0.32, 0.32, 0.12);
    for (const x of [0.12, 0.32]) {
      part(limb(scene, "l-tooth", v(s * x, -0.13, 0.55), v(s * x, -0.25, 0.55), 0.06, 0, 4), head, teeth);
    }
  }

  const tail = node("l-tail", model, 0, 0.7, -0.95);
  part(lengthwise(scene, "l-tail", [
    { z: -1.85, w: 0.02, h: 0.02, dy: -0.3 }, { z: -1.3, w: 0.13, h: 0.11, dy: -0.25 },
    { z: -0.6, w: 0.25, h: 0.2, dy: -0.17 }, { z: 0, w: 0.34, h: 0.28, dy: -0.06 },
  ]), tail, hide);

  const shoulder = (s: number): TransformNode => {
    const pivot = node("l-shoulder", model, s * 0.78, 0.95, 0.55);
    part(limb(scene, "l-arm", v(0, 0.1, 0), v(s * 0.04, -0.42, 0.04), 0.42, 0.28), pivot, hide);
    part(limb(scene, "l-forearm", v(s * 0.04, -0.42, 0.04), v(0, -0.78, 0.06), 0.28, 0.3), pivot, hide);
    for (const cx of [-0.12, 0, 0.12]) {
      part(limb(scene, "l-claw", v(cx, -0.8, 0.12), v(cx * 1.3, -0.88, 0.36), 0.08, 0, 4), pivot, dark);
    }
    return pivot;
  };
  for (const s of [-1, 1]) {
    part(lengthwise(scene, "l-hind", [
      { z: -0.85, w: 0.16, h: 0.12, dy: 0.15 }, { z: -0.55, w: 0.22, h: 0.3, dy: 0.3 },
      { z: -0.25, w: 0.16, h: 0.2, dy: 0.32 },
    ]), model, hide).position.x = s * 0.72;
    const foot = sphere("l-foot", model, dark);
    foot.scaling.set(0.34, 0.12, 0.42);
    foot.position.set(s * 0.74, 0.06, -0.45);
  }

  for (const p of parts) sky.castShadows(p);
  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return {
    root, model, trunk, head, jaw, tail, arms: [shoulder(-1), shoulder(1)], materials, baseEmissive, eyes, gait: 0,
    visualYaw: yaw, spin: 0, clock: 0, pace: 0,
  };
}
