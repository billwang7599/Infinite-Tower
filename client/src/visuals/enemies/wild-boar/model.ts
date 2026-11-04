/**
 * The boar's 3D model, built in code (no asset files). 3D so its wind-ups read clearly from
 * any angle. Faces +z locally.
 */
import { Color3, Mesh, MeshBuilder, TransformNode, type StandardMaterial } from "@babylonjs/core";
import type { EnemyDef, Entity } from "@infinite-tower/shared";
import type { ArenaScene } from "../../battle/scene.js";
import { enemyMaterial, lengthwise, limb } from "../shape.js";

/** The charge telegraph: a stripe this long on the ground, starting just in front of the snout. */
const TELEGRAPH_LENGTH = 14;

export interface BoarModel {
  /** Under the body's node; rotated to the boar's facing. */
  root: TransformNode;
  /** Child of root: lean, tremble, fall over. */
  model: TransformNode;
  trunk: Mesh;
  head: TransformNode;
  ears: TransformNode[];
  tail: TransformNode;
  /** Hip pivots: front-left, front-right, back-left, back-right. */
  legs: [TransformNode, TransformNode, TransformNode, TransformNode];
  stars: TransformNode;
  /** Ground stripe showing the charge line during the wind-up. */
  telegraph: Mesh;
  materials: StandardMaterial[];
  /** Each material's own emissive color (same order), to return to after the hit flash. */
  baseEmissive: Color3[];
  eyes: StandardMaterial;
  gait: number;
  visualYaw: number;
  clock: number;
}

export function disposeBoar(v: BoarModel): void {
  v.root.dispose(); // and everything under it, the telegraph too
  for (const m of v.materials) m.dispose();
}

export function buildBoar(ctx: ArenaScene, e: Entity, parent: TransformNode, def: EnemyDef, yaw: number): BoarModel {
  const { scene, sky } = ctx;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, hex: string): StandardMaterial => {
    const m = enemyMaterial(scene, name, hex);
    materials.push(m);
    return m;
  };
  const hide = mat("boar-hide", "#5b4434");
  const dark = mat("boar-dark", "#2e241d");
  const snoutM = mat("boar-snout", "#7a584a");
  const nose = mat("boar-nose", "#9a6a5c");
  const ivory = mat("boar-tusk", "#efe6cf");
  const eyes = mat("boar-eyes", "#1a0a08");

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

  const root = new TransformNode(`boar-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius; // feet on the ground
  const model = node(`boar-model-${e}`, root, 0, 0, 0);

  const trunk = part(lengthwise(scene, "b-body", [
    { z: -1.02, w: 0.16, h: 0.16, dy: -0.02 }, { z: -0.88, w: 0.42, h: 0.38, dy: -0.03 },
    { z: -0.5, w: 0.54, h: 0.46, dy: -0.02 }, { z: -0.05, w: 0.58, h: 0.5, dy: 0.02 },
    { z: 0.35, w: 0.56, h: 0.56, dy: 0.08 }, { z: 0.72, w: 0.44, h: 0.46, dy: 0.06 },
    { z: 0.92, w: 0.28, h: 0.3, dy: 0.03 },
  ]), model, hide);
  trunk.position.y = 0.95;
  const belly = part(lengthwise(scene, "b-belly", [
    { z: -0.6, w: 0.3, h: 0.12 }, { z: 0, w: 0.4, h: 0.16 }, { z: 0.55, w: 0.34, h: 0.14 },
  ]), trunk, snoutM);
  belly.position.y = -0.4;
  part(Mesh.MergeMeshes(Array.from({ length: 9 }, (_, i) => {
    const z = -0.45 + i * 0.15, h = 0.2 + 0.12 * Math.sin((Math.PI * (i + 1)) / 10);
    const y = 0.42 + 0.1 * Math.sin((Math.PI * (i + 2)) / 11);
    return limb(scene, "b-bristle", { x: 0, y, z }, { x: 0, y: y + h, z: z - 0.14 }, 0.16, 0, 4);
  }), true)!, trunk, dark);
  const tail = node("b-tail", model, 0, 1.02, -1.0);
  part(limb(scene, "b-tail", { x: 0, y: 0, z: 0 }, { x: 0, y: -0.32, z: -0.12 }, 0.07, 0.04, 5), tail, dark);
  const tuft = part(MeshBuilder.CreateSphere("b-tuft", { diameter: 0.12, segments: 4 }, scene), tail, dark);
  tuft.position.set(0, -0.34, -0.13);

  // Head pivots at the neck so it can be raised / lowered for the attack tells.
  const head = node("b-head", model, 0, 1.05, 0.8);
  part(lengthwise(scene, "b-skull", [
    { z: -0.12, w: 0.3, h: 0.32, dy: 0.02 }, { z: 0.15, w: 0.34, h: 0.34 }, { z: 0.45, w: 0.27, h: 0.26, dy: -0.08 },
    { z: 0.62, w: 0.22, h: 0.2, dy: -0.13 },
  ]), head, hide);
  part(lengthwise(scene, "b-snout", [
    { z: 0.55, w: 0.2, h: 0.18, dy: -0.14 }, { z: 0.85, w: 0.18, h: 0.17, dy: -0.15 },
    { z: 0.99, w: 0.19, h: 0.18, dy: -0.15 },
  ]), head, snoutM);
  const disc = part(MeshBuilder.CreateCylinder("b-nose", { height: 0.05, diameter: 0.34 }, scene), head, nose);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, -0.15, 1.0);
  const ears: TransformNode[] = [];
  for (const s of [-1, 1]) {
    const tuskAt = { x: s * 0.17, y: -0.2, z: 0.82 }, bend = { x: s * 0.27, y: -0.08, z: 0.9 };
    part(limb(scene, "b-tusk", tuskAt, bend, 0.09, 0.06, 6), head, ivory);
    part(limb(scene, "b-tusk", bend, { x: s * 0.3, y: 0.08, z: 0.84 }, 0.06, 0, 6), head, ivory);
    const ear = node("b-ear", head, s * 0.2, 0.28, 0.1);
    const flap = part(limb(scene, "b-ear", { x: 0, y: 0, z: 0 }, { x: s * 0.12, y: 0.24, z: -0.1 }, 0.2, 0.02, 4),
      ear, dark);
    flap.scaling.z = 0.5;
    ears.push(ear);
    const eye = part(MeshBuilder.CreateSphere("b-eye", { diameter: 0.1, segments: 6 }, scene), head, eyes);
    eye.position.set(s * 0.24, 0.07, 0.5);
  }

  const hip = (x: number, z: number, front: boolean): TransformNode => {
    const pivot = node("b-hip", model, x, 0.75, z);
    part(limb(scene, "b-thigh", { x: 0, y: 0.12, z: 0 }, { x: 0, y: -0.36, z: front ? 0.02 : -0.04 },
      front ? 0.34 : 0.4, 0.2), pivot, hide);
    part(limb(scene, "b-shin", { x: 0, y: -0.36, z: front ? 0.02 : -0.04 }, { x: 0, y: -0.64, z: 0.02 }, 0.19, 0.15),
      pivot, hide);
    const hoof = part(limb(scene, "b-hoof", { x: 0, y: -0.62, z: 0.02 }, { x: 0, y: -0.71, z: 0.04 }, 0.16, 0.21, 6),
      pivot, dark);
    hoof.scaling.z = 1.2;
    return pivot;
  };
  const legs: BoarModel["legs"] = [hip(-0.32, 0.55, true), hip(0.32, 0.55, true), hip(-0.32, -0.6, false),
    hip(0.32, -0.6, false)];

  // Dizzy stars, shown while stunned.
  const stars = new TransformNode("b-stars", scene);
  stars.parent = model;
  stars.position.set(0, 2.05, 0.7);
  const starMat = mat("boar-star", "#ffd84a");
  starMat.emissiveColor = new Color3(1.2, 1.0, 0.3);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const star = MeshBuilder.CreatePolyhedron("b-star", { type: 0, size: 0.09 }, scene);
    star.parent = stars;
    star.material = starMat;
    star.position.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
  }
  stars.setEnabled(false);

  const telegraph = MeshBuilder.CreateGround(`boar-telegraph-${e}`, { width: 1.7, height: TELEGRAPH_LENGTH }, scene);
  telegraph.parent = root;
  telegraph.position.set(0, 0.04, TELEGRAPH_LENGTH / 2 + 1.2);
  telegraph.material = ctx.materials.telegraph;
  telegraph.isPickable = false;
  telegraph.setEnabled(false);

  for (const p of parts) sky.castShadows(p);

  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  return {
    root, model, trunk, head, ears, tail, legs, stars, telegraph, materials, baseEmissive, eyes, gait: 0,
    visualYaw: yaw, clock: 0,
  };
}
