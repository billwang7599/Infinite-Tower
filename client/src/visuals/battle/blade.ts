import {
  Axis, Color3, MeshBuilder, Quaternion, TransformNode, Vector3, type Camera, type Mesh, type Scene,
  type StandardMaterial,
} from "@babylonjs/core";
import { dampFactor, wrapAngle, type Entity, type Vec3, type WeaponId } from "@infinite-tower/shared";
import { colorMaterial } from "../materials.js";
import type { ArenaScene } from "./scene.js";
import { WEAPON_LOOKS, type WeaponLook } from "./weapons.js";

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
    box("guard", { width: 0.24, height: 0.04, depth: 0.06 }, 0.12, materials.guard),
    box("blade", { width: widthM, height: lengthM, depth: 0.02 }, 0.14 + lengthM / 2, materials.steel),
  ];
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
  return { weapon, root, hand, materials: Object.values(materials), at: null, yaw };
}

export function dropBlade(blade: HeldBlade | null): void {
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
