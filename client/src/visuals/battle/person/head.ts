import { Mesh, MeshBuilder, VertexData, type TransformNode } from "@babylonjs/core";
import type { Look, Vec3 } from "@infinite-tower/shared";
import { render, type Picture } from "../../../gfx/look/art.js";
import { chibiSketch, colorsOf } from "../../../gfx/look/look.js";
import type { Ramp } from "../../../gfx/look/palette.js";
import { BASE, DEEP, LIGHT, SHADOW } from "../../../gfx/look/pixels.js";
import { placeBetween } from "../arm.js";
import { loft, type Section } from "./loft.js";
import type { Kit } from "./model.js";
import { M_PER_PX, restAt } from "./skeleton.js";

/** The chibi's face (32x32, facing front) is painted on: its middle column, the head's middle row, half-sizes. */
export const FACE = { size: 32, middleX: 16, middleY: 11.4, halfWidth: 8.2, halfHeight: 8 } as const;
const NOSE = { x: 16, y: 15 }, BLUSH = [{ x: 11, y: 15 }, { x: 20, y: 15 }] as const;

/** Sprite pixels: the head's middle above the head joint, and its half-sizes. */
export const HEAD = { middlePx: 8.5, x: 9.7, y: 9.5, z: 9.4 } as const;
/** Below the middle the head narrows to the chin (× 1 − chin y²) and drops by `jaw`. */
const FACE_SHAPES: Record<Look["face"], { chin: number; jaw: number }> = {
  soft: { chin: 0.3, jaw: 1.05 }, sharp: { chin: 0.42, jaw: 1.1 }, square: { chin: 0.18, jaw: 1 },
};

const hex = (h: string): [number, number, number] =>
  [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function faceTexels(look: Look): Picture {
  const { size } = FACE, ramps = colorsOf(look);
  const features = render(chibiSketch(look, "front"), ["eyes", "mouth"]);
  const rgba = new Uint8ClampedArray(size * size * 4);
  const put = (x: number, y: number, color: string) => rgba.set([...hex(color), 255], (y * size + x) * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, ramps.skin![BASE]);
  put(NOSE.x, NOSE.y, ramps.skin![SHADOW]);
  for (const b of BLUSH) put(b.x, b.y, ramps.blush![SHADOW]);
  for (let i = 0; i < size * size; i++) {
    if (features.rgba[i * 4 + 3]) rgba.set(features.rgba.subarray(i * 4, i * 4 + 4), i * 4);
  }
  return { width: size, height: size, rgba };
}

export const HAIR_TEXELS = { width: 8, height: 16 } as const;

/** Rows from the crown. */
export function hairTexels(ramp: Ramp): Picture {
  const { width, height } = HAIR_TEXELS, rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const tone = x === 0 ? DEEP : x === 4 ? SHADOW : (y === 3 || y === 4) && x % 4 !== 3 ? LIGHT
      : y >= height - 4 ? SHADOW : BASE;
    rgba.set([...hex(ramp[tone]), 255], (y * width + x) * 4);
  }
  return { width, height, rgba };
}

const unitSphere = (): VertexData => VertexData.CreateSphere({ segments: 16, diameter: 2 });
const R = { x: HEAD.x * M_PER_PX, y: HEAD.y * M_PER_PX, z: HEAD.z * M_PER_PX };
const MIDDLE_M = HEAD.middlePx * M_PER_PX;
const inHead = (u: Vec3): Vec3 => ({ x: u.x * R.x, y: MIDDLE_M + u.y * R.y, z: u.z * R.z });

function meshOf(kit: Kit, name: string, positions: number[], indices: number[], uvs: number[]): Mesh {
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new Mesh(name, kit.scene);
  Object.assign(new VertexData(), { positions, indices, normals, uvs }).applyToMesh(mesh);
  return mesh;
}

// Behind the ears the head takes the texture's skin-only edge, so the face isn't smeared round it.
function headMesh(kit: Kit, face: Look["face"]): Mesh {
  const sphere = unitSphere(), from = sphere.positions!, { chin, jaw } = FACE_SHAPES[face];
  const positions: number[] = [], uvs: number[] = [];
  for (let i = 0; i < from.length; i += 3) {
    let [x, y, z] = [from[i]!, from[i + 1]!, from[i + 2]!];
    if (y < 0) {
      x *= 1 - chin * y * y;
      z *= 1 - chin * 0.5 * y * y;
      y *= jaw;
    }
    const at = inHead({ x, y, z });
    positions.push(at.x, at.y, at.z);
    const col = z > 0 ? FACE.middleX - x * FACE.halfWidth : x > 0 ? 0.5 : FACE.size - 0.5;
    const row = Math.min(FACE.size - 0.5, Math.max(0.5, FACE.middleY - y * FACE.halfHeight));
    uvs.push(col / FACE.size, row / FACE.size);
  }
  return meshOf(kit, "person-head", positions, [...sphere.indices!], uvs);
}

/** `sways`: hangs from the hair joint, so it swings. */
interface Lock { from: Vec3; to: Vec3; width: number; sways?: boolean }
interface HairStyle {
  /** Where on the unit head the hair lies (+z the face, +y the crown). */
  covers: (x: number, y: number, z: number) => boolean;
  /** How far it flares out at the bottom, as a share of the head. */
  flare: number;
  locks: readonly Lock[];
  /** Unit-head sections hanging behind: a ponytail. */
  tail?: readonly Section[];
  tie?: Vec3;
}

const HAIRLINE = 0.18, TAIL_STRANDS = 3;
export const HAIR_SHELL = 1.1;
const FRINGE: readonly Lock[] = [-0.6, -0.25, 0.1, 0.45].map((x, i) => ({
  from: { x, y: 0.62, z: 0.85 }, to: { x: x + (i - 1.5) * 0.08, y: -0.02 + (i % 2) * 0.12, z: 1.08 }, width: 0.5,
}));
const sideLocks = (y: number): Lock[] => [-1, 1].map((s) => ({
  from: { x: s * 0.95, y: 0.3, z: 0.35 }, to: { x: s * 1.0, y, z: 0.45 }, width: 0.45, sways: true,
}));

const BACK_LOCKS: readonly Lock[] = [-0.75, -0.38, 0, 0.38, 0.75].map((x, i) => ({
  from: { x: x * 0.9, y: -0.1, z: -0.92 }, to: { x: x * 1.1, y: -2.5 + Math.abs(i - 2) * 0.35, z: -1 }, width: 0.8,
  sways: true,
}));

export const HAIR_STYLES: Record<Look["hair"], HairStyle> = {
  short: {
    covers: (x, y, z) => y > HAIRLINE || (z < -0.15 && y > -0.62) || (Math.abs(x) > 0.72 && y > -0.2 && z < 0.5),
    flare: 0, locks: FRINGE,
  },
  bob: {
    covers: (_x, y, z) => y > HAIRLINE || (z < 0.3 && y > -0.85),
    flare: 0.22, locks: [...FRINGE, ...sideLocks(-0.75)],
  },
  long: {
    covers: (_x, y, z) => y > HAIRLINE || (z < 0.3 && y > -0.8),
    flare: 0.1, locks: [...FRINGE, ...sideLocks(-1.6), ...BACK_LOCKS],
  },
  ponytail: {
    covers: (x, y, z) => y > HAIRLINE || (z < -0.1 && y > -0.55) || (Math.abs(x) > 0.72 && y > -0.1 && z < 0.4),
    flare: 0, locks: FRINGE, tie: { x: 0, y: 0.3, z: -1.08 },
    tail: [
      { y: -1.9, x: 0.04, z: 0.04, dz: -1.15 }, { y: -1.3, x: 0.22, z: 0.18, dz: -1.32 },
      { y: -0.4, x: 0.32, z: 0.26, dz: -1.38 }, { y: 0.3, x: 0.26, z: 0.22, dz: -1.18 },
    ],
  },
};

function hairShell(kit: Kit, style: HairStyle): Mesh {
  const sphere = unitSphere(), from = sphere.positions!, all = sphere.indices!, kept = new Map<number, number>();
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const unit = (i: number): Vec3 => ({ x: from[i * 3]!, y: from[i * 3 + 1]!, z: from[i * 3 + 2]! });
  const vertex = (i: number): number => {
    const known = kept.get(i);
    if (known !== undefined) return known;
    const u = unit(i), out = HAIR_SHELL * (1 + style.flare * Math.max(0, -u.y));
    const p = inHead({ x: u.x * out, y: u.y * HAIR_SHELL, z: u.z * out });
    positions.push(p.x, p.y, p.z);
    uvs.push((Math.atan2(u.x, u.z) / (2 * Math.PI) + 0.5) * 6, (1 - u.y) / 2);
    kept.set(i, kept.size);
    return kept.size - 1;
  };
  for (let i = 0; i < all.length; i += 3) {
    const [a, b, c] = [unit(all[i]!), unit(all[i + 1]!), unit(all[i + 2]!)];
    if (style.covers((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3)) {
      indices.push(vertex(all[i]!), vertex(all[i + 1]!), vertex(all[i + 2]!));
    }
  }
  return meshOf(kit, "person-hair", positions, indices, uvs);
}

const PIVOT = restAt("hair", "medium");
const offPivot = (at: Vec3): Vec3 => ({ x: at.x - PIVOT.x, y: at.y - PIVOT.y, z: at.z - PIVOT.z });

export function buildHead(kit: Kit, head: TransformNode, hair: TransformNode, look: Look): void {
  const { scene, part, mat } = kit, style = HAIR_STYLES[look.hair];
  part(headMesh(kit, look.face), head, mat("face"));
  for (const s of [-1, 1]) {
    const ear = part(MeshBuilder.CreateSphere("person-ear", { diameter: 2, segments: 6 }, scene), head, mat("skin"));
    const at = inHead({ x: s * 0.98, y: -0.2, z: 0 });
    ear.position.set(at.x, at.y, at.z);
    ear.scaling.set(R.x * 0.16, R.y * 0.26, R.z * 0.2);
  }
  part(hairShell(kit, style), head, mat("hair"));
  for (const lock of style.locks) {
    const on = lock.sways ? offPivot : (at: Vec3) => at, from = on(inHead(lock.from)), to = on(inHead(lock.to));
    const m = part(MeshBuilder.CreateCylinder("person-lock", {
      height: Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z),
      diameterTop: 0, diameterBottom: lock.width * R.x, tessellation: 4,
    }, scene), lock.sways ? hair : head, mat("hair"));
    placeBetween(m, from, to);
    m.scaling.z = 0.45;
  }
  if (style.tail) {
    const sections = style.tail.map((s) => ({
      y: MIDDLE_M + s.y * R.y - PIVOT.y, x: s.x * R.x, z: s.z * R.z, dz: (s.dz ?? 0) * R.z - PIVOT.z,
    }));
    part(loft(scene, "person-tail", sections, undefined, TAIL_STRANDS), hair, mat("hair"));
  }
  if (style.tie) {
    const tie = part(MeshBuilder.CreateSphere("person-tie", { diameter: 2, segments: 6 }, scene), hair, mat("accent"));
    const at = offPivot(inHead(style.tie));
    tie.position.set(at.x, at.y, at.z);
    tie.scaling.set(R.x * 0.2, R.y * 0.2, R.z * 0.16);
  }
}
