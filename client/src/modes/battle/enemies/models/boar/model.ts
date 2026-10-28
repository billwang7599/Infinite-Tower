/**
 * The boar's 3D model, built from primitives (no asset files). 3D so its wind-ups read clearly from
 * any angle. Faces +z locally; animated procedurally by boarAnimationSystem (animation.ts).
 */
import { Color3, MeshBuilder, TransformNode, type Mesh, type StandardMaterial } from "@babylonjs/core";
import { defineComponent, type EnemyDef, type Entity, type World } from "@infinite-tower/shared";
import { colorMaterial } from "../../../../../gfx/materials.js";
import type { BattleContext } from "../../../context.js";

/** The charge telegraph: a stripe this long on the ground, starting just in front of the snout. */
const TELEGRAPH_LENGTH = 14;

/** The boar's node hierarchy, posed every frame by boarAnimationSystem. */
export interface BoarModelData {
  /** Under the body's node; rotated to the boar's facing. */
  root: TransformNode;
  /** Child of root: lean, tremble, fall over. */
  model: TransformNode;
  head: TransformNode;
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
}
export const BoarModel = defineComponent<BoarModelData>("BoarModel");

export function registerBoarDisposers(world: World): void {
  world.onRemove(BoarModel, (_e, v) => {
    v.root.dispose(); // and everything under it, the telegraph too
    for (const m of v.materials) m.dispose();
  });
}

/** Builds the boar under the body's node (`parent`), facing `yaw`, and adds its BoarModel component. */
export function addBoarModel(
  ctx: BattleContext, world: World, e: Entity, parent: TransformNode, def: EnemyDef, yaw: number,
): void {
  const { scene, sunShadows } = ctx;
  const materials: StandardMaterial[] = [];
  const mat = (name: string, hex: string): StandardMaterial => {
    const m = colorMaterial(scene, name, Color3.FromHexString(hex), new Color3(0.05, 0.05, 0.05));
    materials.push(m);
    return m;
  };
  const hide = mat("boar-hide", "#5e4030");
  const dark = mat("boar-dark", "#2e211a");
  const snoutM = mat("boar-snout", "#8a5a4a");
  const nose = mat("boar-nose", "#b77a6a");
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

  const root = new TransformNode(`boar-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -def.radius; // feet on the ground
  const model = new TransformNode(`boar-model-${e}`, scene);
  model.parent = root;

  const body = part(MeshBuilder.CreateSphere("b-body", { diameter: 1, segments: 12 }, scene), model, hide);
  body.scaling.set(1.15, 1.0, 1.9);
  body.position.set(0, 0.95, -0.05);
  const mane = part(MeshBuilder.CreateBox("b-mane", { width: 0.28, height: 0.3, depth: 1.5 }, scene), model, dark);
  mane.position.set(0, 1.42, 0.1);
  mane.rotation.x = 0.12;
  const tail = part(MeshBuilder.CreateCylinder("b-tail", { height: 0.4, diameter: 0.07 }, scene), model, dark);
  tail.position.set(0, 1.05, -1.0);
  tail.rotation.x = -0.6;

  // Head pivots at the neck so it can be raised / lowered for the attack tells.
  const head = new TransformNode("b-head", scene);
  head.parent = model;
  head.position.set(0, 1.05, 0.8);
  const skull = part(MeshBuilder.CreateSphere("b-skull", { diameter: 1, segments: 10 }, scene), head, hide);
  skull.scaling.set(0.75, 0.7, 0.85);
  skull.position.set(0, -0.05, 0.3);
  const snoutShape = { height: 0.5, diameterTop: 0.36, diameterBottom: 0.46 };
  const snout = part(MeshBuilder.CreateCylinder("b-snout", snoutShape, scene), head, snoutM);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.15, 0.75);
  const disc = part(MeshBuilder.CreateCylinder("b-nose", { height: 0.05, diameter: 0.38 }, scene), head, nose);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, -0.15, 1.0);
  for (const s of [-1, 1]) {
    const tuskShape = { height: 0.4, diameterTop: 0, diameterBottom: 0.1, tessellation: 8 };
    const tusk = part(MeshBuilder.CreateCylinder("b-tusk", tuskShape, scene), head, ivory);
    tusk.position.set(s * 0.2, -0.18, 0.8);
    tusk.rotation.set(0.5, 0, -s * 0.35); // up, forward and outward
    const ear = part(MeshBuilder.CreateBox("b-ear", { width: 0.12, height: 0.28, depth: 0.2 }, scene), head, dark);
    ear.position.set(s * 0.27, 0.3, 0.12);
    ear.rotation.set(-0.3, 0, -s * 0.45);
    const eye = part(MeshBuilder.CreateSphere("b-eye", { diameter: 0.1, segments: 6 }, scene), head, eyes);
    eye.position.set(s * 0.24, 0.07, 0.55);
  }

  const hip = (x: number, z: number): TransformNode => {
    const pivot = new TransformNode("b-hip", scene);
    pivot.parent = model;
    pivot.position.set(x, 0.75, z);
    const leg = part(MeshBuilder.CreateBox("b-leg", { width: 0.22, height: 0.7, depth: 0.24 }, scene), pivot, hide);
    leg.position.y = -0.35;
    const hoof = part(MeshBuilder.CreateBox("b-hoof", { width: 0.24, height: 0.1, depth: 0.28 }, scene), pivot, dark);
    hoof.position.set(0, -0.7, 0.02);
    return pivot;
  };
  const legs: BoarModelData["legs"] = [hip(-0.38, 0.55), hip(0.38, 0.55), hip(-0.38, -0.6), hip(0.38, -0.6)];

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

  for (const p of parts) sunShadows.addShadowCaster(p);

  root.rotation.y = yaw;
  const baseEmissive = materials.map((m) => m.emissiveColor.clone());
  world.add(e, BoarModel, {
    root, model, head, legs, stars, telegraph, materials, baseEmissive, eyes, gait: 0, visualYaw: yaw,
  });
}
