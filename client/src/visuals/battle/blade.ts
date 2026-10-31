import {
  Axis, Color3, MeshBuilder, Quaternion, StandardMaterial, TransformNode, Vector3, type Camera, type Mesh, type Scene,
} from "@babylonjs/core";
import { dampFactor, wrapAngle, type Entity, type SwingData, type Vec3, type WeaponId } from "@infinite-tower/shared";
import { colorMaterial } from "../materials.js";
import type { ArenaScene } from "./scene.js";
import { glintOf, WEAPON_LOOKS, type WeaponLook } from "./weapons.js";

const BLADE_FROM_M = 0.14;

export interface BladeMaterials { grip: StandardMaterial; guard: StandardMaterial; steel: StandardMaterial }

export function buildBlade(scene: Scene, hand: TransformNode, look: WeaponLook, materials: BladeMaterials): Mesh[] {
  const box = (name: string, size: { width: number; height: number; depth: number }, y: number,
    material: StandardMaterial): Mesh => {
    const m = MeshBuilder.CreateBox(name, size, scene);
    m.parent = hand;
    m.position.y = y;
    m.material = material;
    m.isPickable = false;
    return m;
  };
  const gripM = look.twoHanded ? 0.42 : 0.2, { lengthM, widthM } = look.blade;
  return [
    box("grip", { width: 0.05, height: gripM, depth: 0.05 }, 0.1 - gripM / 2, materials.grip),
    box("guard", { width: 0.24, height: 0.04, depth: 0.06 }, BLADE_FROM_M - 0.02, materials.guard),
    box("blade", { width: widthM, height: lengthM, depth: 0.02 }, BLADE_FROM_M + lengthM / 2, materials.steel),
  ];
}

const GLINT_SIZE_M = 0.5;

export interface BladeCue { glint: TransformNode; material: StandardMaterial }

export function cueBlade(scene: Scene, hand: TransformNode, look: WeaponLook): BladeCue {
  const material = new StandardMaterial("blade-glint", scene);
  material.disableLighting = true;
  material.diffuseColor = Color3.Black();
  material.emissiveColor = new Color3(2, 1.8, 1.2);
  material.backFaceCulling = false;
  const glint = new TransformNode("blade-glint", scene);
  glint.parent = hand;
  glint.position.y = BLADE_FROM_M + look.blade.lengthM;
  glint.billboardMode = TransformNode.BILLBOARDMODE_ALL;
  for (const [turn, size] of [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.45], [-Math.PI / 4, 0.45]] as const) {
    const ray = MeshBuilder.CreatePlane("blade-glint-ray", { width: GLINT_SIZE_M * size, height: 0.03 }, scene);
    ray.parent = glint;
    ray.rotation.z = turn;
    ray.material = material;
    ray.isPickable = false;
    ray.renderingGroupId = 1;
  }
  glint.setEnabled(false);
  return { glint, material };
}

export function dropCue(cue: BladeCue | null): void {
  cue?.glint.dispose();
  cue?.material.dispose();
}

export function showCue(cue: BladeCue, swing: SwingData | null): void {
  const glint = glintOf(swing);
  cue.glint.setEnabled(glint > 0);
  cue.glint.scaling.setAll(glint);
}

const STEEL_GLOW = 0.4;
const TURN_RATE = 18;
const YAW_RATE = 15;
/** The sprite's hand jumps from frame to frame: the hilt slides after it. */
const HAND_FOLLOW_RATE = 30;
const bladeDir = new Vector3(), bladeTurn = new Quaternion(), cameraRight = new Vector3();

export interface HeldBlade {
  weapon: WeaponId;
  root: TransformNode;
  hand: TransformNode;
  materials: StandardMaterial[];
  /** The hand on the sprite's plane (m), from the node: across as the camera sees it, and up. */
  at: { x: number; y: number } | null;
  yaw: number;
  cue: BladeCue;
}

export function holdBlade(ctx: ArenaScene, e: Entity, node: TransformNode, weapon: WeaponId, yaw: number): HeldBlade {
  const { scene } = ctx, look = WEAPON_LOOKS[weapon];
  const root = new TransformNode(`blade-${e}`, scene), hand = new TransformNode(`blade-hand-${e}`, scene);
  root.parent = node;
  hand.parent = root;
  const steel = Color3.FromHexString(look.blade.color);
  const materials = {
    grip: colorMaterial(scene, "blade-grip", Color3.FromHexString("#4a3424")),
    guard: colorMaterial(scene, "blade-guard", Color3.FromHexString("#b8913a")),
    steel: colorMaterial(scene, "blade-steel", steel, new Color3(0.3, 0.3, 0.3)),
  };
  // Against the arena's dark floor its shaded side would vanish.
  materials.steel.emissiveColor = steel.scale(STEEL_GLOW);
  for (const mesh of buildBlade(scene, hand, look, materials)) ctx.sky.castShadows(mesh);
  return {
    weapon, root, hand, materials: Object.values(materials), at: null, yaw, cue: cueBlade(scene, hand, look),
  };
}

export function dropBlade(blade: HeldBlade | null): void {
  dropCue(blade?.cue ?? null);
  blade?.root.dispose();
  for (const m of blade?.materials ?? []) m.dispose();
}

export function placeBlade(
  blade: HeldBlade, camera: Camera, hand: { x: number; y: number }, yaw: number,
  pose: { blade: Vec3; exact: boolean }, dt: number,
): void {
  const at = blade.at ??= { ...hand }, k = dampFactor(HAND_FOLLOW_RATE, dt);
  at.x += (hand.x - at.x) * k;
  at.y += (hand.y - at.y) * k;
  camera.getDirectionToRef(Axis.X, cameraRight);
  const flat = Math.hypot(cameraRight.x, cameraRight.z) || 1;
  blade.root.position.set((cameraRight.x / flat) * at.x, at.y, (cameraRight.z / flat) * at.x);
  blade.yaw += wrapAngle(yaw - blade.yaw) * dampFactor(YAW_RATE, dt);
  blade.root.rotation.y = blade.yaw;
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), bladeDir.set(pose.blade.x, pose.blade.y, pose.blade.z), bladeTurn);
  const turned = blade.hand.rotationQuaternion ??= bladeTurn.clone();
  Quaternion.SlerpToRef(turned, bladeTurn, pose.exact ? 1 : dampFactor(TURN_RATE, dt), turned);
}
