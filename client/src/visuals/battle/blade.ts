import {
  Axis, Color3, Mesh, MeshBuilder, Quaternion, RawTexture, StandardMaterial, Texture, TransformNode, Vector3, VertexData,
  type Camera, type Node, type Scene,
} from "@babylonjs/core";
import { dampFactor, wrapAngle, type Entity, type SwingData, type Vec3, type WeaponId } from "@infinite-tower/shared";
import { toPicture, type BattleFrame, type Picture } from "../../gfx/look/art.js";
import { FIXED } from "../../gfx/look/palette.js";
import { OUTLINE, outline, Pen, Pixels, SHADOW } from "../../gfx/look/pixels.js";
import { BLADE_FROM, BLADE_HALF, POINT } from "../../gfx/look/sword.js";
import { colorMaterial } from "../materials.js";
import { buildBow, type HeldBow } from "./bow.js";
import { keepSharp } from "./pixel.js";
import type { ArenaScene } from "./scene.js";
import { glintOf, WEAPON_LOOKS, type WeaponLook } from "./weapons.js";

export const BLADE_FROM_M = 0.14;
const THICKNESS_SHARE = 0.35;
const TEXTURE_LEVEL = 1.15;
const STEEL_GLOW = 0.2;

export interface BladeMaterials { grip: StandardMaterial; guard: StandardMaterial; steel: StandardMaterial }

export interface BladeArt {
  picture: Picture;
  /** Where on the picture the blade's edges take their colour from, 0..1. */
  edge: { u: number; v: number };
}

const ACROSS_PX = 2 * Math.ceil(BLADE_HALF);

export function bladeArt(look: WeaponLook): BladeArt | null {
  const draw = look.art?.battle?.front?.weapon;
  if (!draw) return null;
  const lengthPx = Math.round((look.blade.lengthM / look.blade.widthM) * ACROSS_PX), height = ACROSS_PX + 2;
  const mid = height / 2, px = new Pixels(BLADE_FROM + lengthPx, height);
  // A sword's draw reads only the frame's sword line.
  draw(new Pen(px, 0), { sword: [[0, mid], [BLADE_FROM + lengthPx, mid]] } as unknown as BattleFrame);
  outline(px, new Set([0]));
  // A dark outline would swallow a blade a few pixels wide: its edges are shaded instead.
  px.tones.forEach((tone, i) => { if (tone === OUTLINE) px.tones[i] = SHADOW; });
  const whole = toPicture(px, FIXED), rgba = new Uint8ClampedArray(lengthPx * ACROSS_PX * 4);
  const top = mid - ACROSS_PX / 2;
  const edgeInk = [1, 3, 5].map((i) => parseInt(FIXED.steel[SHADOW].slice(i, i + 2), 16));
  for (let y = 0; y < ACROSS_PX; y++) {
    for (let x = 0; x < lengthPx; x++) {
      const at = ((top + y) * whole.width + BLADE_FROM + x) * 4, to = (y * lengthPx + x) * 4;
      if (whole.rgba[at + 3]) rgba.set(whole.rgba.subarray(at, at + 4), to);
      else rgba.set([...edgeInk, 255], to);
    }
  }
  const picture = { width: lengthPx, height: ACROSS_PX, rgba };
  const column = Math.floor(lengthPx / 2), lightest = Array.from({ length: ACROSS_PX }, (_, y) => y)
    .reduce((best, y) => (brightness(picture, column, y) > brightness(picture, column, best) ? y : best), 0);
  return { picture, edge: { u: (column + 0.5) / lengthPx, v: (lightest + 0.5) / ACROSS_PX } };
}

const brightness = ({ rgba, width }: Picture, x: number, y: number): number =>
  rgba[(y * width + x) * 4]! + rgba[(y * width + x) * 4 + 1]! + rgba[(y * width + x) * 4 + 2]!;

const textures = new WeakMap<Scene, Map<WeaponLook, Texture>>();

function bladeTexture(scene: Scene, look: WeaponLook, art: BladeArt): Texture {
  const byLook = textures.get(scene) ?? new Map<WeaponLook, Texture>();
  textures.set(scene, byLook);
  let texture = byLook.get(look);
  if (!texture) {
    const { width, height, rgba } = art.picture;
    texture = RawTexture.CreateRGBATexture(rgba, width, height, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    // The art's tones multiply the blade's colour: brought back up to about its plain grey's brightness.
    texture.level = TEXTURE_LEVEL;
    byLook.set(look, texture);
  }
  return texture;
}

function bladeMesh(scene: Scene, look: WeaponLook, art: BladeArt | null): Mesh {
  const { lengthM, widthM } = look.blade, half = widthM / 2, depth = widthM * THICKNESS_SHARE;
  const point = art ? (POINT / art.picture.width) * lengthM : 0;
  const shape: [number, number][] = [
    [-half, 0], [half, 0], [half, lengthM - point], [0, lengthM], [-half, lengthM - point],
  ];
  const uvOf = ([x, y]: [number, number]) => [y / lengthM, 0.5 - x / widthM];
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const corner = (x: number, y: number, z: number, n: [number, number, number], uv: number[]) => {
    positions.push(x, BLADE_FROM_M + y, z);
    normals.push(...n);
    uvs.push(...uv);
    return positions.length / 3 - 1;
  };
  for (const side of [1, -1]) {
    const ids = shape.map((p) => corner(p[0], p[1], (side * depth) / 2, [0, 0, side], uvOf(p)));
    for (let i = 1; i < ids.length - 1; i++) {
      indices.push(...(side > 0 ? [ids[0]!, ids[i + 1]!, ids[i]!] : [ids[0]!, ids[i]!, ids[i + 1]!]));
    }
  }
  const edgeUv = art ? [art.edge.u, art.edge.v] : [0, 0];
  shape.forEach(([x0, y0], i) => {
    const [x1, y1] = shape[(i + 1) % shape.length]!, len = Math.hypot(x1 - x0, y1 - y0);
    const n: [number, number, number] = [(y1 - y0) / len, -(x1 - x0) / len, 0];
    const [a, b, c, d] = [[x0, y0, 1], [x1, y1, 1], [x1, y1, -1], [x0, y0, -1]]
      .map(([x, y, z]) => corner(x!, y!, (z! * depth) / 2, n, edgeUv));
    indices.push(a!, b!, c!, a!, c!, d!);
  });
  const mesh = new Mesh("blade", scene), data = new VertexData();
  Object.assign(data, { positions, normals, uvs, indices });
  data.applyToMesh(mesh);
  return mesh;
}

export function buildBlade(scene: Scene, hand: TransformNode, look: WeaponLook, materials: BladeMaterials): Mesh[] {
  const box = (name: string, size: { width: number; height: number; depth: number }, y: number,
    material: StandardMaterial): Mesh => {
    const m = MeshBuilder.CreateBox(name, size, scene);
    m.position.y = y;
    m.material = material;
    return m;
  };
  const gripM = look.twoHanded ? 0.42 : 0.2, art = bladeArt(look), blade = bladeMesh(scene, look, art);
  blade.material = materials.steel;
  if (art) materials.steel.diffuseTexture = bladeTexture(scene, look, art);
  // Against the arena's dark floor its shaded side would vanish.
  materials.steel.emissiveColor = materials.steel.diffuseColor.scale(STEEL_GLOW);
  const meshes = [
    box("grip", { width: 0.05, height: gripM, depth: 0.05 }, 0.1 - gripM / 2, materials.grip),
    box("guard", { width: 0.24, height: 0.04, depth: 0.06 }, BLADE_FROM_M - 0.02, materials.guard),
    blade,
  ];
  for (const m of meshes) {
    m.parent = hand;
    m.isPickable = false;
  }
  keepSharp(blade);
  return meshes;
}

const edgeAt = new Vector3();

export function bladeEdge(hand: TransformNode, look: WeaponLook): { base: Vec3; tip: Vec3 } {
  const chain: TransformNode[] = [];
  for (let n: Node | null = hand; n; n = n.parent) if (n instanceof TransformNode) chain.unshift(n);
  for (const n of chain) n.computeWorldMatrix(true);
  const at = (y: number): Vec3 => {
    Vector3.TransformCoordinatesFromFloatsToRef(0, y, 0, hand.getWorldMatrix(), edgeAt);
    return { x: edgeAt.x, y: edgeAt.y, z: edgeAt.z };
  };
  return { base: at(BLADE_FROM_M), tip: at(BLADE_FROM_M + look.blade.lengthM) };
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
    keepSharp(ray);
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
  bow: HeldBow | null;
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
    steel: colorMaterial(scene, "blade-steel", steel, new Color3(0.18, 0.18, 0.18)),
  };
  const bow = look.bow ? buildBow(scene, hand, { ...look, bow: look.bow }, materials.steel, materials.grip) : null;
  if (bow) materials.steel.emissiveColor = materials.steel.diffuseColor.scale(STEEL_GLOW);
  for (const mesh of bow?.meshes ?? buildBlade(scene, hand, look, materials)) ctx.sky.castShadows(mesh);
  return {
    weapon, root, hand, materials: [...Object.values(materials), ...(bow?.materials ?? [])], at: null, yaw,
    cue: cueBlade(scene, hand, look), bow: bow?.held ?? null,
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
