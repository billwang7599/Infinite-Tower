import { Color3, MeshBuilder, TransformNode, type Mesh, type StandardMaterial } from "@babylonjs/core";
import {
  Body, damp, dampFactor, Enemy, Health, PounceAttack, wrapAngle, type EnemyState, type PounceDef, type Vec3,
} from "@infinite-tower/shared";
import { fighter } from "../../battle/battle.js";
import { easePace, enemyMaterial, flashMaterials, lengthwise, limb } from "../shape.js";

const FLAP_RAD_PER_SEC = 40;

interface ChickenModel {
  root: TransformNode;
  model: TransformNode;
  head: TransformNode;
  wings: [TransformNode, TransformNode];
  legs: [TransformNode, TransformNode];
  materials: StandardMaterial[];
  baseEmissive: Color3[];
  gait: number;
  pace: number;
  ground: number;
  visualYaw: number;
  clock: number;
}

interface ChickenPose { lift: number; crouch: number; headPitch: number; headZ: number; flap: boolean; roll: number }

const arc = (t: number, of: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t / of)));

function chickenPose(state: EnemyState, t: number, pounce?: PounceDef): ChickenPose {
  const p: ChickenPose = { lift: 0, crouch: 0, headPitch: 0, headZ: 0, flap: false, roll: 0 };
  switch (state) {
    case "pounceWindup":
      return { ...p, crouch: 0.08, headPitch: -0.5, headZ: -0.06 };
    case "pounce":
      return { ...p, lift: 0.35 * arc(t, pounce?.active ?? 1), headPitch: 0.6, headZ: 0.08, flap: true };
    case "pounceRecover":
      return { ...p, headPitch: 0.9, headZ: 0.06 };
    case "pounceHop":
      return { ...p, lift: 0.3 * arc(t, pounce?.hopTime ?? 1), flap: true };
    case "stunned":
    case "staggered":
      return { ...p, roll: Math.sin(t * 16) * 0.25, flap: true };
    case "dead":
      return { ...p, roll: Math.PI / 2, crouch: 0.05 };
    default:
      return p;
  }
}

export const chickenVisual = fighter<ChickenModel>("enemy", {
  spawn(ctx, world, e, node) {
    const { scene, sky } = ctx, enemy = world.require(e, Enemy);
    const materials: StandardMaterial[] = [];
    const mat = (name: string, hex: string) => {
      const m = enemyMaterial(scene, name, hex);
      materials.push(m);
      return m;
    };
    const feathers = mat("chicken-feathers", "#e9e2d0"), red = mat("chicken-comb", "#c0392b");
    const beak = mat("chicken-beak", "#e0a030"), eye = mat("chicken-eye", "#141414");
    const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
    const pivot = (name: string, under: TransformNode, x: number, y: number, z: number) => {
      const n = new TransformNode(`${name}-${e}`, scene);
      n.parent = under;
      n.position.set(x, y, z);
      return n;
    };
    const part = (m: Mesh, under: TransformNode, material: StandardMaterial): Mesh => {
      m.parent = under;
      m.material = material;
      m.isPickable = false;
      sky.castShadows(m);
      return m;
    };

    const root = pivot("chicken-root", node, 0, -enemy.def.radius, 0);
    root.rotation.y = enemy.yaw;
    const model = pivot("chicken-model", root, 0, 0, 0);
    const body = part(lengthwise(scene, "c-body", [
      { z: -0.2, w: 0.04, h: 0.08, dy: 0.12 }, { z: -0.12, w: 0.13, h: 0.12, dy: 0.04 },
      { z: 0.04, w: 0.15, h: 0.14 }, { z: 0.14, w: 0.11, h: 0.11, dy: 0.04 },
    ]), model, feathers);
    body.position.y = 0.3;
    const tail = part(limb(scene, "c-tail", v(0, 0, 0), v(0, 0.16, -0.08), 0.1, 0.02, 5), model, feathers);
    tail.position.set(0, 0.36, -0.18);

    const head = pivot("c-neck", model, 0, 0.42, 0.12);
    part(limb(scene, "c-neck", v(0, 0, 0), v(0, 0.1, 0.03), 0.09, 0.07, 6), head, feathers);
    const skull = part(MeshBuilder.CreateSphere("c-head", { diameter: 0.12, segments: 5 }, scene), head, feathers);
    skull.position.set(0, 0.13, 0.04);
    const bill = part(limb(scene, "c-beak", v(0, 0, 0), v(0, -0.01, 0.07), 0.04, 0.005, 4), head, beak);
    bill.position.set(0, 0.12, 0.09);
    const comb = part(MeshBuilder.CreateBox("c-comb", { width: 0.02, height: 0.05, depth: 0.08 }, scene), head, red);
    comb.position.set(0, 0.2, 0.04);
    const wattle = part(MeshBuilder.CreateSphere("c-wattle", { diameter: 0.04, segments: 3 }, scene), head, red);
    wattle.position.set(0, 0.07, 0.09);
    for (const s of [-1, 1]) {
      const dot = part(MeshBuilder.CreateSphere("c-eye", { diameter: 0.025, segments: 3 }, scene), head, eye);
      dot.position.set(s * 0.05, 0.15, 0.07);
    }

    const wing = (s: number) => {
      const at = pivot("c-wing", model, s * 0.14, 0.36, 0.02);
      const flat = part(MeshBuilder.CreateSphere("c-wing", { diameter: 0.22, segments: 4 }, scene), at, feathers);
      flat.scaling.set(0.2, 0.55, 1);
      flat.position.set(s * 0.01, -0.04, -0.03);
      return at;
    };
    const leg = (s: number) => {
      const hip = pivot("c-hip", model, s * 0.06, 0.2, 0);
      part(limb(scene, "c-leg", v(0, 0.02, 0), v(0, -0.18, 0), 0.025, 0.02, 4), hip, beak);
      const foot = part(MeshBuilder.CreateBox("c-foot", { width: 0.06, height: 0.015, depth: 0.08 }, scene), hip, beak);
      foot.position.set(0, -0.19, 0.02);
      return hip;
    };

    return {
      root, model, head, wings: [wing(-1), wing(1)], legs: [leg(-1), leg(1)], materials,
      baseEmissive: materials.map((m) => m.emissiveColor.clone()), gait: 0, pace: 0, ground: 0, visualYaw: enemy.yaw,
      clock: 0,
    };
  },
  dispose(c) {
    c.root.dispose();
    for (const m of c.materials) m.dispose();
  },
  frame(c, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    c.clock += dt;
    c.visualYaw += wrapAngle(enemy.yaw - c.visualYaw) * dampFactor(18, dt);
    c.root.rotation.y = c.visualYaw;
    const pose = chickenPose(health.hp > 0 ? enemy.state : "dead", enemy.stateTime, world.get(e, PounceAttack)?.def);
    const speed = c.pace = easePace(c.pace, Math.hypot(body.vel.x, body.vel.z), dt);
    c.gait += dt * speed * 9;
    const stride = Math.min(0.7, speed * 0.25);
    c.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(c.gait + i * Math.PI) * stride; });
    const flap = pose.flap ? Math.abs(Math.sin(c.clock * FLAP_RAD_PER_SEC)) * 1.2 : 0;
    c.wings.forEach((wing, i) => { wing.rotation.z = damp(wing.rotation.z, (i === 0 ? -1 : 1) * flap, 30, dt); });
    const bob = speed > 0.2 ? Math.sin(c.gait * 2) * 0.03 : 0;
    c.head.rotation.x = damp(c.head.rotation.x, pose.headPitch, 20, dt);
    c.head.position.z = damp(c.head.position.z, 0.12 + pose.headZ + bob, 20, dt);
    c.model.rotation.z = damp(c.model.rotation.z, pose.roll, 10, dt);
    c.ground = damp(c.ground, -pose.crouch, 12, dt);
    c.model.position.y = c.ground + pose.lift;
    flashMaterials(c.materials, c.baseEmissive, health.flash);
  },
});
