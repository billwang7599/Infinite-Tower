import { Color3, MeshBuilder, TransformNode, type Mesh, type StandardMaterial } from "@babylonjs/core";
import { damp, Enemy, Health, STRIKES, type Strike } from "@infinite-tower/shared";
import { fighter } from "../../battle/battle.js";
import { colorMaterial } from "../../materials.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const STRUCK_COLOR = new Color3(0.9, 0.7, 0.2);
const UNLIT = Color3.Black();
const WOBBLE_RAD = 0.25;
const FALL_RAD = 1.45;

interface DummyModel {
  root: TransformNode;
  model: TransformNode;
  materials: StandardMaterial[];
  marks: Record<Strike, StandardMaterial>;
  clock: number;
}

export const trainingDummyVisual = fighter<DummyModel>("enemy", {
  spawn(ctx, world, e, node) {
    const { scene, sky } = ctx, enemy = world.require(e, Enemy);
    const materials: StandardMaterial[] = [];
    const mat = (name: string, hex: string) => {
      const m = colorMaterial(scene, name, Color3.FromHexString(hex));
      materials.push(m);
      return m;
    };
    const wood = mat("dummy-wood", "#6a4b30"), straw = mat("dummy-straw", "#b89a52");
    const rope = mat("dummy-rope", "#4a3a26");
    const mark = (name: string) => colorMaterial(scene, name, Color3.FromHexString("#3a3026"));
    const marks = { light: mark("dummy-light"), heavy: mark("dummy-heavy"), stab: mark("dummy-stab") };
    const root = new TransformNode(`dummy-root-${e}`, scene);
    root.parent = node;
    root.position.y = -enemy.def.radius;
    root.rotation.y = enemy.yaw;
    const model = new TransformNode(`dummy-model-${e}`, scene);
    model.parent = root;
    const part = (m: Mesh, material: StandardMaterial, x: number, y: number, z: number): Mesh => {
      m.parent = model;
      m.material = material;
      m.position.set(x, y, z);
      m.isPickable = false;
      sky.castShadows(m);
      return m;
    };
    part(MeshBuilder.CreateCylinder("dummy-post", { height: 1.9, diameter: 0.12, tessellation: 8 }, scene), wood,
      0, 0.95, 0);
    const bar = part(MeshBuilder.CreateCylinder("dummy-bar", { height: 1.1, diameter: 0.08, tessellation: 8 }, scene),
      wood, 0, 1.35, 0);
    bar.rotation.z = Math.PI / 2;
    part(MeshBuilder.CreateCylinder("dummy-sack", { height: 0.75, diameterTop: 0.42, diameterBottom: 0.5,
      tessellation: 10 }, scene), straw, 0, 1.05, 0);
    part(MeshBuilder.CreateSphere("dummy-head", { diameter: 0.34, segments: 8 }, scene), straw, 0, 1.68, 0);
    part(MeshBuilder.CreateTorus("dummy-rope", { diameter: 0.46, thickness: 0.04, tessellation: 12 }, scene), rope,
      0, 1.3, 0);
    part(MeshBuilder.CreateBox("dummy-light", { width: 0.08, height: 0.22, depth: 0.08 }, scene), marks.light,
      -0.5, 1.22, 0);
    part(MeshBuilder.CreateBox("dummy-heavy", { width: 0.08, height: 0.22, depth: 0.08 }, scene), marks.heavy,
      0.5, 1.22, 0);
    part(MeshBuilder.CreateBox("dummy-stab", { width: 0.16, height: 0.16, depth: 0.04 }, scene), marks.stab,
      0, 1.05, 0.25);
    return { root, model, materials, marks, clock: 0 };
  },
  dispose(model) {
    model.root.dispose();
    for (const m of [...model.materials, ...Object.values(model.marks)]) m.dispose();
  },
  frame(model, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health);
    model.clock += dt;
    const down = health.hp <= health.floor;
    const wobble = health.flash > 0 ? Math.sin(model.clock * 30) * WOBBLE_RAD * health.flash * 6 : 0;
    model.model.rotation.x = damp(model.model.rotation.x, down ? -FALL_RAD : wobble, down ? 6 : 20, dt);
    for (const strike of STRIKES) {
      model.marks[strike].emissiveColor.copyFrom(enemy.struck.includes(strike) ? STRUCK_COLOR : UNLIT);
    }
    for (const m of model.materials) m.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : UNLIT);
  },
});
