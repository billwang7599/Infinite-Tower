/**
 * The boar's 3D model, built from primitives (no asset files). 3D so its wind-ups read clearly from
 * any angle. Faces +z locally; animated procedurally by boarViewSystem.
 */
import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, type Scene } from "@babylonjs/core";
import { BOAR } from "@infinite-tower/shared";
import type { BoarViewData } from "../components.js";
import type { GameContext } from "../context.js";

function mat(scene: Scene, name: string, hex: string, list: StandardMaterial[]): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  list.push(m);
  return m;
}

/** Builds the model under `parent` (the physics collider). Returns everything BoarView needs except state. */
export function buildBoarModel(ctx: GameContext, e: number, parent: Mesh): Omit<BoarViewData, "gait" | "visualYaw"> {
  const { scene, shadows } = ctx;
  const materials: StandardMaterial[] = [];
  const hide = mat(scene, "boar-hide", "#5e4030", materials);
  const dark = mat(scene, "boar-dark", "#2e211a", materials);
  const snoutM = mat(scene, "boar-snout", "#8a5a4a", materials);
  const nose = mat(scene, "boar-nose", "#b77a6a", materials);
  const ivory = mat(scene, "boar-tusk", "#efe6cf", materials);
  const eyes = mat(scene, "boar-eyes", "#1a0a08", materials);
  for (const m of materials) m.metadata = { baseEmissive: m.emissiveColor.clone() };

  const parts: Mesh[] = [];
  const part = (m: Mesh, parent: TransformNode, material: StandardMaterial): Mesh => {
    m.parent = parent;
    m.material = material;
    m.isPickable = false;
    parts.push(m);
    return m;
  };

  const root = new TransformNode(`boar-root-${e}`, scene);
  root.parent = parent;
  root.position.y = -BOAR.radius; // feet on the ground
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
  const snout = part(MeshBuilder.CreateCylinder("b-snout", { height: 0.5, diameterTop: 0.36, diameterBottom: 0.46 }, scene), head, snoutM);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.15, 0.75);
  const disc = part(MeshBuilder.CreateCylinder("b-nose", { height: 0.05, diameter: 0.38 }, scene), head, nose);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, -0.15, 1.0);
  for (const s of [-1, 1]) {
    const tusk = part(MeshBuilder.CreateCylinder("b-tusk", { height: 0.4, diameterTop: 0, diameterBottom: 0.1, tessellation: 8 }, scene), head, ivory);
    tusk.position.set(s * 0.2, -0.18, 0.8);
    tusk.rotation.set(0.5, 0, -s * 0.35); // up, forward and outward
    const ear = part(MeshBuilder.CreateBox("b-ear", { width: 0.12, height: 0.28, depth: 0.2 }, scene), head, dark);
    ear.position.set(s * 0.27, 0.3, 0.12);
    ear.rotation.set(-0.3, 0, -s * 0.45);
    const eye = part(MeshBuilder.CreateSphere("b-eye", { diameter: 0.1, segments: 6 }, scene), head, eyes);
    eye.position.set(s * 0.24, 0.07, 0.55);
  }

  const legs: TransformNode[] = [];
  for (const [x, z] of [[-0.38, 0.55], [0.38, 0.55], [-0.38, -0.6], [0.38, -0.6]] as const) {
    const hip = new TransformNode("b-hip", scene);
    hip.parent = model;
    hip.position.set(x, 0.75, z);
    const leg = part(MeshBuilder.CreateBox("b-leg", { width: 0.22, height: 0.7, depth: 0.24 }, scene), hip, hide);
    leg.position.y = -0.35;
    const hoof = part(MeshBuilder.CreateBox("b-hoof", { width: 0.24, height: 0.1, depth: 0.28 }, scene), hip, dark);
    hoof.position.set(0, -0.7, 0.02);
    legs.push(hip);
  }

  // Dizzy stars, shown while stunned.
  const stars = new TransformNode("b-stars", scene);
  stars.parent = model;
  stars.position.set(0, 2.05, 0.7);
  const starMat = mat(scene, "boar-star", "#ffd84a", materials);
  starMat.emissiveColor = new Color3(1.2, 1.0, 0.3);
  starMat.metadata = { baseEmissive: starMat.emissiveColor.clone() };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const star = MeshBuilder.CreatePolyhedron("b-star", { type: 0, size: 0.09 }, scene);
    star.parent = stars;
    star.material = starMat;
    star.position.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
  }
  stars.setEnabled(false);

  const telegraph = MeshBuilder.CreateGround(`boar-telegraph-${e}`, { width: 1.7, height: 14 }, scene);
  telegraph.parent = root;
  telegraph.position.set(0, 0.04, 7.0 + 1.2);
  telegraph.material = ctx.materials.telegraph;
  telegraph.isPickable = false;
  telegraph.setEnabled(false);

  for (const p of parts) shadows.addShadowCaster(p);

  return { root, model, head, legs, stars, telegraph, materials, eyes };
}
