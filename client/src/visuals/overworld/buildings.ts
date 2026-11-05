import { Color3, Mesh, StandardMaterial, VertexData, type Scene } from "@babylonjs/core";
import { seededRandom, tileAt, type Rect, type WorldMap } from "@infinite-tower/shared";
import { pixelCanvas } from "../sprites.js";
import type { Pen } from "./props.js";
import { castleTopAt, type Ledge } from "./scenery.js";
import { crenelsOf, sideOut, SIGNS, type House, type RoofKind, type Side, type WallKind } from "./town.js";

type V = readonly [number, number, number];

/** One picture of the atlas covers this many tiles a side, at the ground's 16 pixels a tile. */
const CELL_TILES = 2;
const CELL_PX = 32;
const CELLS_ACROSS = 8;
const CELL = {
  timber: 0, stone: 1, ochre: 2, brick: 3, ashlar: 4, walk: 5, plinth: 6, trim: 7,
  red: 8, slate: 9, brown: 10, green: 11, ridge: 12, chimney: 13, door: 14, doorArched: 15,
  window: 16, shutter: 17, planter: 18, bloom: 19, lantern: 20, banner: 21, shaft: 22, marble: 23,
  iron: 24, slit: 25, sign: 26,
} as const;
const WALL_CELL: Record<WallKind, number> = { timber: CELL.timber, stone: CELL.stone, ochre: CELL.ochre, brick: CELL.brick };
const ROOF_CELL: Record<RoofKind, number> = { red: CELL.red, slate: CELL.slate, brown: CELL.brown, green: CELL.green };

const HOUSE = {
  plinthY: 0.35, plinthOut: 0.05, eaveOut: 0.32, gableOut: 0.22, roofThick: 0.14, ridgeIn: 0.02,
  capY: 0.14, capOut: 0.06, door: { w: 0.9, h: 1.6, frame: 0.1, out: 0.09 }, window: { w: 0.56, h: 0.72, apart: 1.7 },
};
// × the sky's ambient, under the lit colour's clamp: faces in shade keep their own colour, sunlit ones don't change.
const SHADE_FILL = 1.2;
const LAMP = { postY: 2.15, lanternY: 2.6 };
/** `pierW` tiles beside the way, `out` past the wall's faces, `jambIn` into the way; `lintelY` from the arch's top to its spring. */
const GATE = { pierW: 1.2, out: 0.35, jambIn: 0.12, lintelY: 1.9 };
const WALL = { plinthY: 0.5, plinthOut: 0.09, merlonW: 0.55, merlonY: 0.6, parapetY: 0.22, depth: 0.42, bannerEvery: 7 };

class Geo {
  readonly pos: number[] = [];
  readonly nrm: number[] = [];
  readonly uv: number[] = [];
  readonly idx: number[] = [];

  quad(o: V, u: V, v: V, cell: number, out: V, stretch = false): void {
    const corners: V[] = [o, add(o, u), add(add(o, u), v), add(o, v)];
    if (stretch) this.poly(corners, [[0, 0], [1, 0], [1, 1], [0, 1]], cell, out);
    else this.face(corners, o, norm(u), norm(v), cell, out);
  }

  // The atlas can't wrap, so a face is cut where its picture repeats.
  face(points: V[], o: V, u: V, v: V, cell: number, out: V): void {
    const at = points.map((p): Mapped => ({ p, s: dot(sub(p, o), u) / CELL_TILES, t: dot(sub(p, o), v) / CELL_TILES }));
    const from = (k: "s" | "t") => Math.floor(Math.min(...at.map((q) => q[k]))), to = (k: "s" | "t") => Math.max(...at.map((q) => q[k]));
    for (let a = from("s"); a < to("s"); a++) {
      for (let b = from("t"); b < to("t"); b++) {
        const piece = cutAt(cutAt(cutAt(cutAt(at, "s", a, 1), "s", a + 1, -1), "t", b, 1), "t", b + 1, -1);
        if (areaOf(piece) < MIN_PIECE) continue;
        this.poly(piece.map((q) => q.p), piece.map((q) => [q.s - a, q.t - b]), cell, out);
      }
    }
  }

  poly(points: V[], st: [number, number][], cell: number, out: V): void {
    // Newell's normal, so a gable's piece with one corner on another still has one.
    let n: V = [0, 0, 0];
    points.forEach((p, k) => {
      const q = points[(k + 1) % points.length]!;
      n = add(n, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]);
    });
    n = norm(len(n) > 1e-12 ? n : out);
    if (dot(n, out) < 0) n = scale(n, -1);
    const base = this.pos.length / 3, col = cell % CELLS_ACROSS, row = Math.floor(cell / CELLS_ACROSS);
    points.forEach((p, k) => {
      const [s, t] = st[k]!;
      this.pos.push(...p);
      this.nrm.push(...n);
      this.uv.push((col + clampIn(s)) / CELLS_ACROSS, 1 - (row + 1 - clampIn(t)) / CELLS_ACROSS);
    });
    for (let k = 1; k + 1 < points.length; k++) this.idx.push(base, base + k, base + k + 1);
  }

  box(
    lo: V, hi: V, side: number, top: number | null = null, stretch = false, bottom: number | null = null,
    skipFacing: V | null = null,
  ): void {
    const [x0, y0, z0] = lo, [x1, y1, z1] = hi, w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const sides: [V, V, V][] = [
      [[x0, y0, z0], [w, 0, 0], [0, 0, -1]], [[x1, y0, z1], [-w, 0, 0], [0, 0, 1]],
      [[x0, y0, z1], [0, 0, -d], [-1, 0, 0]], [[x1, y0, z0], [0, 0, d], [1, 0, 0]],
    ];
    for (const [o, u, out] of sides) if (!skipFacing || dot(out, skipFacing) < 0.5) this.quad(o, u, [0, h, 0], side, out, stretch);
    if (top !== null) this.quad([x0, y1, z0], [w, 0, 0], [0, 0, d], top, [0, 1, 0], stretch);
    if (bottom !== null) this.quad([x0, y0, z1], [w, 0, 0], [0, 0, -d], bottom, [0, -1, 0], stretch);
  }

  ring(x: number, z: number, sides: number, r0: number, y0: number, r1: number, y1: number, cell: number, inward = false): void {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2, b = ((i + 1) / sides) * Math.PI * 2, mid = (a + b) / 2;
      const at = (ang: number, r: number, y: number): V => [x + Math.cos(ang) * r, y, z + Math.sin(ang) * r];
      const out: V = [Math.cos(mid) * (inward ? -1 : 1), r0 > r1 ? 1 : 0.2, Math.sin(mid) * (inward ? -1 : 1)];
      this.poly([at(a, r0, y0), at(b, r0, y0), at(b, r1, y1), at(a, r1, y1)], [[0, 0], [1, 0], [1, 1], [0, 1]], cell, out);
    }
  }

  disc(x: number, z: number, sides: number, r: number, y: number, cell: number, inner = 0): void {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2, b = ((i + 1) / sides) * Math.PI * 2;
      const at = (ang: number, rr: number): V => [x + Math.cos(ang) * rr, y, z + Math.sin(ang) * rr];
      if (inner > 0) this.poly([at(a, inner), at(b, inner), at(b, r), at(a, r)], [[0, 0], [1, 0], [1, 1], [0, 1]], cell, [0, 1, 0]);
      else this.poly([[x, y, z], at(a, r), at(b, r)], [[0.5, 0.5], [1, 0], [1, 1]], cell, [0, 1, 0]);
    }
  }

  mesh(name: string, scene: Scene, material: StandardMaterial): Mesh {
    const mesh = new Mesh(name, scene), data = new VertexData();
    Object.assign(data, { positions: this.pos, normals: this.nrm, uvs: this.uv, indices: this.idx });
    data.applyToMesh(mesh);
    mesh.material = material;
    return mesh;
  }
}

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V): V => scale(a, 1 / (len(a) || 1));
// Kept off the cell's edge so nearest sampling never takes the neighbour's pixels.
const clampIn = (s: number) => Math.min(0.995, Math.max(0.005, s));

interface Mapped { p: V; s: number; t: number }
const MIN_PIECE = 1e-6;

function cutAt(poly: Mapped[], k: "s" | "t", edge: number, keep: 1 | -1): Mapped[] {
  const out: Mapped[] = [], inside = (q: Mapped) => (q[k] - edge) * keep >= 0;
  poly.forEach((q, i) => {
    const r = poly[(i + 1) % poly.length]!;
    if (inside(q)) out.push(q);
    if (inside(q) !== inside(r)) {
      const f = (edge - q[k]) / (r[k] - q[k]);
      out.push({ p: add(q.p, scale(sub(r.p, q.p), f)), s: q.s + (r.s - q.s) * f, t: q.t + (r.t - q.t) * f });
    }
  });
  return out;
}

const areaOf = (poly: Mapped[]) =>
  Math.abs(poly.reduce((sum, q, i) => { const r = poly[(i + 1) % poly.length]!; return sum + q.s * r.t - r.s * q.t; }, 0)) / 2;

/** `l` along the ridge, `s` across it, from the house's middle. */
interface Frame { at(l: number, y: number, s: number): V; dir(l: number, y: number, s: number): V }

function frameOf(ledge: Ledge, alongX: boolean): Frame {
  const cx = ledge.rect.x + ledge.rect.w / 2, cz = ledge.rect.z + ledge.rect.h / 2;
  return alongX
    ? { at: (l, y, s) => [cx + l, y, cz + s], dir: (l, y, s) => [l, y, s] }
    : { at: (l, y, s) => [cx - s, y, cz + l], dir: (l, y, s) => [-s, y, l] };
}

interface Face { side: Side; mid: V; along: V; out: V; width: number }

function facesOf(ledge: Ledge): Face[] {
  const { x, z, w, h } = ledge.rect;
  return [
    { side: "south", mid: [x + w / 2, 0, z], along: [1, 0, 0], out: [0, 0, -1], width: w },
    { side: "north", mid: [x + w / 2, 0, z + h], along: [-1, 0, 0], out: [0, 0, 1], width: w },
    { side: "east", mid: [x + w, 0, z + h / 2], along: [0, 0, 1], out: [1, 0, 0], width: h },
    { side: "west", mid: [x, 0, z + h / 2], along: [0, 0, -1], out: [-1, 0, 0], width: h },
  ];
}

function onFace(g: Geo, f: Face, at: number, y: number, w: number, h: number, proud: number, cell: number): void {
  const o = add(add(f.mid, scale(f.along, at - w / 2)), add(scale(f.out, proud), [0, y, 0]));
  g.quad(o, scale(f.along, w), [0, h, 0], cell, f.out, true);
}

function outOfFace(
  g: Geo, f: Face, at: number, y: number, w: number, h: number, back: number, front: number, cell: number, stretch = true,
): void {
  const a = add(add(f.mid, scale(f.along, at - w / 2)), scale(f.out, back)), b = add(add(f.mid, scale(f.along, at + w / 2)), scale(f.out, front));
  const lo: V = [Math.min(a[0], b[0]), y, Math.min(a[2], b[2])], hi: V = [Math.max(a[0], b[0]), y + h, Math.max(a[2], b[2])];
  g.box(lo, hi, cell, cell, stretch, null, back === 0 ? scale(f.out, -1) : null);
}

const SIDES: readonly Side[] = ["south", "north", "east", "west"];

interface Edge { side: Side; ns: boolean; count: number; base: number; outside(i: number): [number, number]; inside(i: number): [number, number] }

function edgeOf(rect: Rect, side: Side): Edge {
  const { x, z } = rect, x1 = x + rect.w, z1 = z + rect.h, ns = side === "north" || side === "south";
  return {
    side, ns, count: ns ? rect.w : rect.h, base: ns ? x : z,
    outside: (i) => (ns ? [x + i, side === "north" ? z1 : z - 1] : [side === "east" ? x1 : x - 1, z + i]),
    inside: (i) => (ns ? [x + i, side === "north" ? z1 - 1 : z] : [side === "east" ? x1 - 1 : x, z + i]),
  };
}

function runsOf(count: number, on: (i: number) => boolean): [number, number][] {
  const runs: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    if (!on(i)) continue;
    let end = i + 1;
    while (end < count && on(end)) end++;
    runs.push([i, end]);
    i = end;
  }
  return runs;
}

const INWARD: Record<Side, V> = { south: [0, 0, 1], north: [0, 0, -1], east: [-1, 0, 0], west: [1, 0, 0] };

function slab(
  g: Geo, rect: Rect, side: Side, a0: number, a1: number, y0: number, y1: number, back: number, front: number, cell: number,
): void {
  const x1 = rect.x + rect.w, z1 = rect.z + rect.h, against = back === 0 ? INWARD[side] : null;
  if (side === "north") g.box([a0, y0, z1 + back], [a1, y1, z1 + front], cell, cell, false, null, against);
  else if (side === "south") g.box([a0, y0, rect.z - front], [a1, y1, rect.z - back], cell, cell, false, null, against);
  else if (side === "east") g.box([x1 + back, y0, a0], [x1 + front, y1, a1], cell, cell, false, null, against);
  else g.box([rect.x - front, y0, a0], [rect.x - back, y1, a1], cell, cell, false, null, against);
}

function sideFace(g: Geo, rect: Rect, side: Side, a0: number, a1: number, y0: number, y1: number, cell: number): void {
  const x1 = rect.x + rect.w, z1 = rect.z + rect.h, up: V = [0, y1 - y0, 0];
  if (side === "south") g.quad([a0, y0, rect.z], [a1 - a0, 0, 0], up, cell, [0, 0, -1]);
  else if (side === "north") g.quad([a1, y0, z1], [a0 - a1, 0, 0], up, cell, [0, 0, 1]);
  else if (side === "east") g.quad([x1, y0, a0], [0, 0, a1 - a0], up, cell, [1, 0, 0]);
  else g.quad([rect.x, y0, a1], [0, 0, a0 - a1], up, cell, [-1, 0, 0]);
}

function bands(
  g: Geo, rect: Rect, y0: number, y1: number, out: number, cell: number, open: (x: number, z: number) => boolean,
): void {
  for (const e of SIDES.map((side) => edgeOf(rect, side))) {
    const outside = (i: number) => open(...e.outside(i)), inside = (i: number) => open(...e.inside(i));
    for (const [i, end] of runsOf(e.count, outside)) {
      const a0 = e.base + i + (e.ns ? (inside(i - 1) ? -out : 0) : (outside(i - 1) ? 0 : out));
      const a1 = e.base + end + (e.ns ? (inside(end) ? out : 0) : (outside(end) ? 0 : -out));
      slab(g, rect, e.side, a0, a1, y0, y1, 0, out, cell);
    }
  }
}

function buildHouse(g: Geo, map: WorldMap, ledge: Ledge, h: House): void {
  const wallCell = WALL_CELL[h.walls], { rect } = ledge, x1 = rect.x + rect.w, z1 = rect.z + rect.h;
  const next = (x: number, z: number) => tileAt(map, x + 0.5, z + 0.5);
  const open = (x: number, z: number) => next(x, z) !== "house" && next(x, z) !== "castleWall";
  const shared = (side: Side) => sideOut(rect, side).every(([x, z]) => next(x, z) === "house");
  bands(g, rect, 0, HOUSE.plinthY, HOUSE.plinthOut, CELL.plinth, open);
  g.box([rect.x, HOUSE.plinthY, rect.z], [x1, h.wallY, z1], wallCell);
  if (!h.roof || !h.ridge) {
    g.box([rect.x, h.wallY, rect.z], [x1, h.wallY + HOUSE.capY, z1], CELL.trim, CELL.trim);
    bands(g, rect, h.wallY, h.wallY + HOUSE.capY, HOUSE.capOut, CELL.trim, open);
    return;
  }
  const alongX = h.ridge === "x", f = frameOf(ledge, alongX), L = (alongX ? rect.w : rect.h) / 2, S = (alongX ? rect.h : rect.w) / 2;
  const rise = ledge.topY - h.wallY, slope = rise / S;
  const endSide = (end: number): Side => (alongX ? (end < 0 ? "west" : "east") : end < 0 ? "south" : "north");
  const [lo, hi] = [-1, 1].map((end) => end * (L + (shared(endSide(end)) ? 0 : HOUSE.gableOut))) as [number, number];
  for (const end of [-1, 1]) {
    const wall = facesOf(ledge).find((face) => face.side === endSide(end))!;
    const from = add(add(wall.mid, scale(wall.along, -wall.width / 2)), [0, HOUSE.plinthY, 0]);
    const triangle: V[] = [f.at(end * L, h.wallY, -S), f.at(end * L, h.wallY, S), f.at(end * L, ledge.topY, 0)];
    g.face(triangle, from, wall.along, [0, 1, 0], wallCell, wall.out);
  }
  const t = HOUSE.roofThick, roofCell = ROOF_CELL[h.roof];
  const eaveSide = (side: number): Side => (alongX ? (side < 0 ? "south" : "north") : side < 0 ? "east" : "west");
  for (const side of [-1, 1]) {
    const over = shared(eaveSide(side)) ? 0 : HOUSE.eaveOut, eave = S + over, eaveY = h.wallY - over * slope;
    const [la, lb] = side > 0 ? [lo, hi] : [hi, lo], u = f.dir(lb - la, 0, 0), v = f.dir(0, ledge.topY - eaveY, -eave * side);
    g.quad(f.at(la, eaveY + t, eave * side), u, v, roofCell, f.dir(0, 1, side));
    g.quad(f.at(la, eaveY, eave * side), u, v, roofCell, f.dir(0, -1, -side));
    g.quad(f.at(la, eaveY, eave * side), u, [0, t, 0], CELL.trim, f.dir(0, 0, side));
    for (const l of [lo, hi]) {
      const edge = f.at(l, eaveY, eave * side), top = f.at(l, ledge.topY, 0);
      g.poly([edge, top, add(top, [0, t, 0]), add(edge, [0, t, 0])], [[0, 0], [1, 0], [1, 1], [0, 1]], CELL.trim, f.dir(Math.sign(l), 0, 0));
    }
  }
  const ridgeLo = f.at(lo + HOUSE.ridgeIn, ledge.topY + t * 0.6, -0.13), ridgeHi = f.at(hi - HOUSE.ridgeIn, ledge.topY + t + 0.1, 0.13);
  g.box(minOf(ridgeLo, ridgeHi), maxOf(ridgeLo, ridgeHi), CELL.ridge, CELL.ridge);
  const rand = seededRandom(rect.x * 31 + rect.z * 977);
  if (h.chimney) {
    const cl = (rand() < 0.5 ? -1 : 1) * Math.max(0, L - 0.7), cs = S * 0.45 * (rand() < 0.5 ? -1 : 1);
    const a = f.at(cl - 0.25, h.wallY, cs - 0.25), b = f.at(cl + 0.25, ledge.topY + 0.75, cs + 0.25);
    g.box(minOf(a, b), maxOf(a, b), CELL.chimney, CELL.trim);
    const ca = f.at(cl - 0.32, ledge.topY + 0.75, cs - 0.32), cb = f.at(cl + 0.32, ledge.topY + 0.9, cs + 0.32);
    g.box(minOf(ca, cb), maxOf(ca, cb), CELL.plinth, CELL.trim);
  }
  for (const face of facesOf(ledge)) {
    if (!shared(face.side)) decorate(g, face, h, rand);
    if (h.use === "barracks") barracksFace(g, face, h);
    if (h.use === "kitchen") kitchenFace(g, face, h);
  }
  if (h.use === "kitchen") {
    for (const cl of [-L * 0.5, L * 0.5]) {
      const a = f.at(cl - 0.35, h.wallY, -S * 0.4 - 0.35), b = f.at(cl + 0.35, ledge.topY + 1.1, -S * 0.4 + 0.35);
      g.box(minOf(a, b), maxOf(a, b), CELL.chimney, CELL.iron);
    }
  }
}

function barracksFace(g: Geo, face: Face, h: House): void {
  for (let at = -face.width / 2 + 0.15; at <= face.width / 2; at += face.width / Math.round(face.width / 2.2)) {
    outOfFace(g, face, at, 0, 0.36, h.wallY * 0.9, 0, 0.32, CELL.plinth);
    outOfFace(g, face, at, h.wallY * 0.9, 0.36, 0.18, 0, 0.18, CELL.plinth);
  }
  if (face.side !== h.door) return;
  for (const side of [-1, 1]) {
    onFace(g, face, side * 1.6, h.wallY - 2.25, 0.7, 1.8, 0.05, CELL.banner);
    outOfFace(g, face, side * 2.6, 0, 0.5, 0.9, 0, 0.45, CELL.trim);
    outOfFace(g, face, side * 2.6, 0.9, 0.06, 0.6, 0.15, 0.35, CELL.iron);
  }
}

function kitchenFace(g: Geo, face: Face, h: House): void {
  if (face.side !== h.door) return;
  const along = (at: number, out: number): V => add(add(face.mid, scale(face.along, at)), scale(face.out, out));
  const oven = along(face.width / 2 - 1.1, 0.75);
  g.ring(oven[0], oven[2], 10, 0.75, 0, 0.75, 0.5, CELL.chimney);
  g.ring(oven[0], oven[2], 10, 0.75, 0.5, 0.05, 1.3, CELL.chimney);
  outOfFace(g, face, face.width / 2 - 1.1, 0.12, 0.42, 0.34, 1.48, 1.52, CELL.iron);
  for (let k = 0; k < 3; k++) outOfFace(g, face, -face.width / 2 + 0.9, 0.18 * k, 1.1 - k * 0.2, 0.18, 0, 0.5, CELL.trim);
  for (const [at, r] of [[-face.width / 2 + 1.9, 0.26], [-face.width / 2 + 2.5, 0.22]] as const) {
    const p = along(at, 0.4);
    g.ring(p[0], p[2], 8, r, 0, r, 0.62, CELL.planter);
    g.disc(p[0], p[2], 8, r, 0.62, CELL.trim);
  }
}

function decorate(g: Geo, face: Face, h: House, rand: () => number): void {
  const { door, window: win } = HOUSE, hasDoor = face.side === h.door;
  const doorAt = hasDoor ? (rand() - 0.5) * Math.max(0, face.width - 2.4) : NaN;
  if (hasDoor) {
    onFace(g, face, doorAt, HOUSE.plinthY, door.w, door.h, 0.02, h.walls === "stone" ? CELL.doorArched : CELL.door);
    outOfFace(g, face, doorAt - door.w / 2 - door.frame / 2, HOUSE.plinthY, door.frame, door.h, 0, door.out, CELL.trim);
    outOfFace(g, face, doorAt + door.w / 2 + door.frame / 2, HOUSE.plinthY, door.frame, door.h, 0, door.out, CELL.trim);
    outOfFace(g, face, doorAt, HOUSE.plinthY + door.h, door.w + door.frame * 2, door.frame * 1.4, 0, door.out + 0.03, CELL.trim);
    outOfFace(g, face, doorAt, 0, door.w + 0.3, 0.16, 0, 0.35, CELL.plinth);
    outOfFace(g, face, doorAt, HOUSE.plinthY + door.h + 0.25, door.w + 0.5, 0.08, 0, 0.45, CELL.trim);
    if (h.lantern) {
      outOfFace(g, face, doorAt + door.w / 2 + 0.35, 1.6, 0.06, 0.06, 0, 0.22, CELL.iron);
      outOfFace(g, face, doorAt + door.w / 2 + 0.35, 1.3, 0.2, 0.3, 0.12, 0.32, CELL.lantern);
    }
    if (h.sign !== null) {
      const side = doorAt - door.w / 2 - 0.25, sign = CELL.sign + (h.sign % SIGNS);
      outOfFace(g, face, side, 2.0, 0.06, 0.06, 0, 0.75, CELL.iron);
      const o = add(add(face.mid, scale(face.along, side)), add(scale(face.out, 0.2), [0, 1.5, 0]));
      g.quad(o, scale(face.out, 0.5), [0, 0.45, 0], sign, face.along, true);
      g.quad(add(o, scale(face.out, 0.5)), scale(face.out, -0.5), [0, 0.45, 0], sign, scale(face.along, -1), true);
    }
  }
  const rows = h.wallY >= 2.9 ? [1.0, h.wallY - 1.05] : [1.05];
  const count = Math.max(1, Math.floor((face.width - 0.4) / win.apart));
  const shutters = h.walls === "timber" || h.walls === "ochre";
  for (const [r, y] of rows.entries()) {
    for (let i = 0; i < count; i++) {
      const at = -face.width / 2 + (face.width * (i + 0.5)) / count;
      if (hasDoor && r === 0 && Math.abs(at - doorAt) < 1.0) continue;
      if (hasDoor && h.sign !== null && Math.abs(at - (doorAt - door.w / 2 - 0.25)) < 0.5 && r === 1) continue;
      onFace(g, face, at, y, win.w, win.h, 0.015, CELL.window);
      outOfFace(g, face, at, y + win.h, win.w + 0.16, 0.08, 0, 0.07, CELL.trim);
      outOfFace(g, face, at, y - 0.07, win.w + 0.2, 0.07, 0, 0.13, CELL.plinth);
      if (shutters) {
        onFace(g, face, at - win.w / 2 - 0.15, y, 0.28, win.h, 0.03, CELL.shutter);
        onFace(g, face, at + win.w / 2 + 0.15, y, 0.28, win.h, 0.03, CELL.shutter);
      }
      if (h.flowers && (r === 1 || rows.length === 1)) {
        outOfFace(g, face, at, y - 0.27, win.w + 0.1, 0.2, 0.02, 0.24, CELL.planter);
        onFace(g, face, at, y - 0.07, win.w + 0.06, 0.16, 0.18, CELL.bloom);
      }
    }
  }
}

const minOf = (a: V, b: V): V => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
const maxOf = (a: V, b: V): V => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];

function buildWall(g: Geo, map: WorldMap, ledge: Ledge): void {
  const { rect, topY } = ledge, lower = (than: number) => (x: number, z: number) => castleTopAt(map, x, z) < than;
  const bare = (x: number, z: number) => lower(WALL.plinthY)(x, z) && tileAt(map, x + 0.5, z + 0.5) !== "house";
  for (const e of SIDES.map((side) => edgeOf(rect, side))) {
    for (const [i, end] of runsOf(e.count, (i) => lower(topY)(...e.outside(i)))) {
      sideFace(g, rect, e.side, e.base + i, e.base + end, 0, topY, CELL.ashlar);
    }
  }
  g.quad([rect.x, topY, rect.z], [rect.w, 0, 0], [0, 0, rect.h], CELL.walk, [0, 1, 0]);
  bands(g, rect, 0, WALL.plinthY, WALL.plinthOut, CELL.plinth, bare);
  bands(g, rect, topY - 0.3, topY - 0.12, WALL.plinthOut * 0.6, CELL.plinth, lower(topY));
  const crenels = ledge.crowned ? everyEdge(ledge) : crenelsOf(map, rect);
  const crenelled = new Set(crenels.map(({ x, z, side }) => `${x},${z},${side}`));
  const atCorner = (x: number, z: number) => crenelled.has(`${x},${z},north`) || crenelled.has(`${x},${z},south`);
  const y1 = topY + WALL.parapetY;
  for (const e of SIDES.map((side) => edgeOf(rect, side))) {
    const on = (i: number) => crenelled.has(`${e.inside(i)},${e.side}`);
    for (const [i, end] of runsOf(e.count, on)) {
      const a0 = e.base + i + (!e.ns && atCorner(...e.inside(i)) ? WALL.depth : 0);
      const a1 = e.base + end - (!e.ns && atCorner(...e.inside(end - 1)) ? WALL.depth : 0);
      slab(g, rect, e.side, a0, a1, topY, y1, -WALL.depth, 0, CELL.ashlar);
    }
  }
  for (const { x, z, side } of crenels) {
    const face = facesOf({ rect: { x, z, w: 1, h: 1 }, topY }).find((f) => f.side === side)!;
    if (side === "north" || side === "south" || !atCorner(x, z)) {
      outOfFace(g, face, 0, y1, WALL.merlonW, WALL.merlonY, -WALL.depth, 0, CELL.ashlar, false);
    }
    const hash = Math.abs(x * 73 + z * 31) % WALL.bannerEvery;
    if (hash === 0 && topY >= 3) {
      onFace(g, face, 0, topY - 2.3, 0.75, 1.9, 0.04, CELL.banner);
      outOfFace(g, face, 0, topY - 0.42, 0.8, 0.05, 0, 0.1, CELL.iron);
    }
    if (topY > 4 && hash === 3) onFace(g, face, 0, topY - 2.4, 0.14, 0.8, 0.01, CELL.slit);
  }
}

function everyEdge(ledge: Ledge): { x: number; z: number; side: Side }[] {
  const { x, z, w, h } = ledge.rect, out: { x: number; z: number; side: Side }[] = [];
  for (let i = 0; i < w; i++) out.push({ x: x + i, z, side: "south" }, { x: x + i, z: z + h - 1, side: "north" });
  for (let i = 0; i < h; i++) out.push({ x, z: z + i, side: "west" }, { x: x + w - 1, z: z + i, side: "east" });
  return out;
}

function buildColumn(g: Geo, ledge: Ledge): void {
  const x = ledge.rect.x + 0.5, z = ledge.rect.z + 0.5, top = ledge.topY;
  g.box([x - 0.45, 0, z - 0.45], [x + 0.45, 0.3, z + 0.45], CELL.marble, CELL.marble);
  g.ring(x, z, 10, 0.34, 0.3, 0.3, top - 0.35, CELL.shaft);
  g.ring(x, z, 10, 0.3, top - 0.35, 0.42, top - 0.18, CELL.marble);
  g.box([x - 0.48, top - 0.18, z - 0.48], [x + 0.48, top, z + 0.48], CELL.marble, CELL.marble);
}

function buildPlinth(g: Geo, ledge: Ledge): void {
  const { rect, topY } = ledge, i = 0.12, x1 = rect.x + rect.w, z1 = rect.z + rect.h;
  g.box([rect.x, 0, rect.z], [x1, 0.3, z1], CELL.plinth, CELL.plinth);
  g.box([rect.x + i, 0.3, rect.z + i], [x1 - i, topY - 0.2, z1 - i], CELL.marble);
  g.box([rect.x + 0.04, topY - 0.2, rect.z + 0.04], [x1 - 0.04, topY, z1 - 0.04], CELL.plinth, CELL.walk);
}

function buildLamp(g: Geo, ledge: Ledge): void {
  const x = ledge.rect.x + 0.5, z = ledge.rect.z + 0.5, { postY, lanternY } = LAMP;
  g.box([x - 0.2, 0, z - 0.2], [x + 0.2, 0.22, z + 0.2], CELL.plinth, CELL.walk);
  g.ring(x, z, 8, 0.11, 0.22, 0.07, postY, CELL.iron);
  g.box([x - 0.16, postY, z - 0.16], [x + 0.16, postY + 0.06, z + 0.16], CELL.iron, CELL.iron);
  g.box([x - 0.13, postY + 0.06, z - 0.13], [x + 0.13, lanternY, z + 0.13], CELL.lantern, null, true);
  g.ring(x, z, 4, 0.2, lanternY, 0.02, lanternY + 0.28, CELL.iron);
}

function buildGate(g: Geo, ledge: Ledge): void {
  const { rect, topY } = ledge, alongX = rect.w > rect.h || (rect.w === rect.h && rect.h === 1);
  const span = alongX ? rect.w : rect.h, f = frameOf(ledge, alongX), half = span / 2, d = 0.5 + GATE.out;
  const archY = Math.max(2.4, topY - GATE.lintelY), way = half - GATE.jambIn;
  const box = (
    l0: number, l1: number, y0: number, y1: number, s0: number, s1: number, side: number, top: number | null,
    bottom: number | null = null,
  ) => {
    const a = f.at(l0, y0, s0), b = f.at(l1, y1, s1);
    g.box(minOf(a, b), maxOf(a, b), side, top, false, bottom);
  };
  for (const end of [-1, 1]) {
    const inner = end * way, outer = end * (half + GATE.pierW);
    box(Math.min(inner, outer), Math.max(inner, outer), 0, topY, -d, d, CELL.ashlar, CELL.walk);
    box(Math.min(inner, outer) - 0.06, Math.max(inner, outer) + 0.06, 0, 0.6, -d - 0.06, d + 0.06, CELL.plinth, CELL.plinth);
    for (const k of [0, 1]) {
      const l = end * (half + GATE.pierW * (k === 0 ? 0.22 : 0.78));
      box(l - 0.2, l + 0.2, topY, topY + 0.55, -d, d, CELL.ashlar, CELL.walk);
    }
    for (const side of [-1, 1]) {
      const l = end * (half + GATE.pierW / 2), s = side * (d + 0.02);
      const o = f.at(l - 0.38, topY - 2.6, s);
      g.quad(o, f.dir(0.76, 0, 0), [0, 2.1, 0], CELL.banner, f.dir(0, 0, side), true);
      box(l - 0.1, l + 0.1, 1.9, 2.2, side * d, side * (d + 0.3), CELL.iron, CELL.iron);
      box(l - 0.14, l + 0.14, 1.5, 1.9, side * (d + 0.14), side * (d + 0.42), CELL.lantern, CELL.iron);
    }
  }
  box(-way, way, archY, topY, -d + 0.05, d - 0.05, CELL.ashlar, CELL.walk);
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const l0 = -way + (2 * way * i) / steps, l1 = -way + (2 * way * (i + 1)) / steps, mid = (l0 + l1) / 2 / way;
    const drop = (1 - Math.sqrt(Math.max(0, 1 - mid * mid))) * Math.min(1.4, archY * 0.4);
    box(l0, l1, archY - Math.min(1.4, archY * 0.4) + drop, archY, -d + 0.05, d - 0.05, CELL.ashlar, null, CELL.ashlar);
  }
  box(-half - 0.05, half + 0.05, archY - 0.12, archY + 0.1, -d - 0.04, d + 0.04, CELL.plinth, CELL.plinth);
  for (let l = -half + 0.25; l < half; l += 0.42) box(l - 0.035, l + 0.035, archY - 0.45, archY, -0.04, 0.04, CELL.iron, null);
  box(-half, half, archY - 0.5, archY - 0.42, -0.05, 0.05, CELL.iron, CELL.iron);
}

function buildFountain(g: Geo, water: Geo, ledge: Ledge): void {
  const { rect, topY } = ledge, x = rect.x + rect.w / 2, z = rect.z + rect.h / 2;
  const r = Math.min(rect.w, rect.h) / 2 - 0.15, inner = r - 0.4, sides = 12;
  g.ring(x, z, sides, r + 0.12, 0, r + 0.12, 0.18, CELL.plinth);
  g.ring(x, z, sides, r, 0.18, r, topY, CELL.marble);
  g.ring(x, z, sides, inner, 0.1, inner, topY, CELL.marble, true);
  g.disc(x, z, sides, r, topY, CELL.walk, inner);
  water.disc(x, z, sides, inner, topY - 0.14, 0);
  const tiers: [number, number, number][] = [[0.42, 1.5, 1.25], [0.26, 2.45, 0.7]];
  let y0 = 0.1;
  for (const [stem, y, bowl] of tiers) {
    g.ring(x, z, 8, stem, y0, stem, y - 0.3, CELL.marble);
    g.ring(x, z, sides, stem, y - 0.3, bowl, y, CELL.marble);
    g.ring(x, z, sides, bowl, y, bowl, y + 0.12, CELL.marble);
    g.disc(x, z, sides, bowl, y + 0.12, CELL.walk, bowl - 0.12);
    water.disc(x, z, sides, bowl - 0.12, y + 0.06, 0);
    y0 = y;
  }
  g.ring(x, z, 8, 0.12, y0, 0.08, y0 + 0.7, CELL.marble);
  g.ring(x, z, 8, 0.2, y0 + 0.7, 0.01, y0 + 1.0, CELL.marble);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, ox = Math.cos(a), oz = Math.sin(a);
    for (const [from, to, y1, y2] of [[0.6, 1.15, 2.5, 1.62], [1.15, 1.75, 1.6, topY - 0.1]] as const) {
      water.poly(
        [[x + ox * from, y1, z + oz * from], [x + ox * to, y2, z + oz * to], [x + ox * to, y2 - 0.05, z + oz * to], [x + ox * from, y1 - 0.05, z + oz * from]],
        [[0, 0], [1, 0], [1, 1], [0, 1]], 0, [ox, 1, oz],
      );
    }
  }
}

export interface TownArt {
  build(map: WorldMap, ledge: Ledge, name: string): Mesh[] | null;
  /** A chunk's lamp posts never fade, so they're one mesh. */
  lamps(ledges: readonly Ledge[], name: string): Mesh | null;
}

export function townArt(scene: Scene): TownArt {
  const material = new StandardMaterial("town", scene);
  material.diffuseTexture = pixelCanvas(scene, "town-atlas", CELL_PX * CELLS_ACROSS, CELL_PX * CELLS_ACROSS, paintAtlas, false);
  material.emissiveTexture = pixelCanvas(scene, "town-glow", CELL_PX * CELLS_ACROSS, CELL_PX * CELLS_ACROSS, paintGlow, false);
  material.specularColor = Color3.Black();
  material.ambientColor = new Color3(SHADE_FILL, SHADE_FILL, SHADE_FILL);
  material.backFaceCulling = false;
  const waterMat = new StandardMaterial("town-water", scene);
  waterMat.diffuseColor = Color3.FromHexString("#1d4a58");
  waterMat.emissiveColor = Color3.FromHexString("#0a2028");
  waterMat.specularColor = new Color3(0.9, 0.9, 0.85);
  waterMat.specularPower = 48;
  waterMat.alpha = 0.85;
  waterMat.backFaceCulling = false;
  return {
    build(map, ledge, name) {
      const g = new Geo();
      if (ledge.look === "house" && ledge.house) buildHouse(g, map, ledge, ledge.house);
      else if (ledge.look === "castle") buildWall(g, map, ledge);
      else if (ledge.look === "column") buildColumn(g, ledge);
      else if (ledge.look === "plinth") buildPlinth(g, ledge);
      else if (ledge.look === "gate") buildGate(g, ledge);
      else if (ledge.look === "fountain") {
        const water = new Geo();
        buildFountain(g, water, ledge);
        return [g.mesh(`fountain-${name}`, scene, material), water.mesh(`fountain-water-${name}`, scene, waterMat)];
      } else return null;
      return [g.mesh(`building-${name}`, scene, material)];
    },
    lamps(ledges, name) {
      if (ledges.length === 0) return null;
      const g = new Geo();
      for (const ledge of ledges) buildLamp(g, ledge);
      return g.mesh(`lamps-${name}`, scene, material);
    },
  };
}

const at = (cell: number) => [(cell % CELLS_ACROSS) * CELL_PX, Math.floor(cell / CELLS_ACROSS) * CELL_PX] as const;

function paintAtlas(pen: Pen): void {
  const rand = seededRandom(41);
  const tones = (list: readonly string[]) => list[Math.floor(rand() * list.length)]!;
  const cell = (c: number, draw: (x: number, y: number) => void) => { const [x, y] = at(c); draw(x, y); };
  const courses = (x: number, y: number, h: number, w: number, mortar: string, faces: readonly string[], hi: string, lo: string) => {
    pen.rect(x, y, 32, 32, mortar);
    for (let row = 0; row * h < 32; row++) {
      const shift = row % 2 ? w / 2 : 0;
      for (let bx = -shift; bx < 32; bx += w) {
        const l = Math.max(bx, 0), r = Math.min(bx + w - 1, 32);
        if (r <= l) continue;
        pen.rect(x + l, y + row * h, r - l, h - 1, tones(faces));
        pen.rect(x + l, y + row * h, r - l, 1, hi);
        pen.rect(x + l, y + row * h + h - 2, r - l, 1, lo);
      }
    }
  };
  const plaster = (x: number, y: number, base: string, spots: readonly string[]) => {
    pen.rect(x, y, 32, 32, base);
    for (let i = 0; i < 46; i++) pen.rect(x + rand() * 31, y + rand() * 31, 2, 1, tones(spots));
  };
  cell(CELL.timber, (x, y) => {
    plaster(x, y, "#cbbd9c", ["#bcae8d", "#d8cbaa", "#c2b393"]);
    const beam = "#4a3324", hi = "#664833";
    pen.rect(x, y, 3, 32, beam); pen.rect(x + 1, y, 1, 32, hi);
    pen.rect(x, y + 15, 32, 3, beam); pen.rect(x, y + 15, 32, 1, hi);
    for (let i = 0; i < 13; i++) { pen.rect(x + 3 + i, y + 14 - i, 2, 1, beam); pen.rect(x + 18 + i, y + 2 + i, 2, 1, beam); }
  });
  cell(CELL.stone, (x, y) => courses(x, y, 8, 12, "#4d4a47", ["#8c877e", "#7f7a72", "#97928a", "#857f76"], "#a8a298", "#625e58"));
  cell(CELL.ochre, (x, y) => {
    plaster(x, y, "#c9965a", ["#b98549", "#d6a568", "#c08c50"]);
    pen.rect(x, y + 30, 32, 2, "#a77a44");
  });
  cell(CELL.brick, (x, y) => courses(x, y, 4, 8, "#5a4a40", ["#8f4a35", "#a0553c", "#843f2e", "#9a5a42"], "#b26a4e", "#6e3426"));
  cell(CELL.ashlar, (x, y) => {
    courses(x, y, 8, 16, "#3a3540", ["#7a7280", "#6c6573", "#857c89", "#71697a"], "#9a92a0", "#55505c");
    for (let i = 0; i < 3; i++) if (rand() < 0.5) pen.rect(x + 2 + rand() * 24, y + 5 + Math.floor(rand() * 3) * 8, 3, 2, "#4f7a3a");
  });
  cell(CELL.walk, (x, y) => courses(x, y, 16, 16, "#55505a", ["#8a8390", "#7e7884", "#958e9a"], "#a49dab", "#6a6470"));
  cell(CELL.plinth, (x, y) => courses(x, y, 16, 16, "#3f3c3a", ["#76716a", "#6b665f", "#807a72"], "#958f86", "#56524c"));
  cell(CELL.trim, (x, y) => {
    pen.rect(x, y, 32, 32, "#4a3324");
    for (let k = 0; k < 32; k += 4) pen.rect(x, y + k, 32, 1, "#3a281b");
    pen.rect(x, y, 32, 1, "#6a4b33");
  });
  const roof = (c: number, faces: readonly string[], line: string) => cell(c, (x, y) => {
    pen.rect(x, y, 32, 32, line);
    for (let row = 0; row < 8; row++) {
      const shift = row % 2 ? 2 : 0;
      for (let bx = -shift; bx < 32; bx += 4) {
        pen.rect(x + Math.max(0, bx), y + row * 4, Math.min(3, 32 - Math.max(0, bx)), 3, tones(faces));
      }
    }
  });
  roof(CELL.red, ["#8a4433", "#7d3c2e", "#94503b", "#86402f"], "#4f241c");
  roof(CELL.slate, ["#4f5866", "#58616f", "#475060", "#5f6876"], "#2c323c");
  roof(CELL.brown, ["#6a5038", "#5e452f", "#755a40", "#634a33"], "#3a2a1c");
  roof(CELL.green, ["#4f7d6a", "#5a8a74", "#46705f", "#629480"], "#2c4a3e");
  cell(CELL.ridge, (x, y) => { pen.rect(x, y, 32, 32, "#3a2a24"); for (let k = 0; k < 32; k += 6) pen.rect(x + k, y, 1, 32, "#2a1e1a"); });
  cell(CELL.chimney, (x, y) => courses(x, y, 4, 8, "#4a3c36", ["#7e4232", "#8a4a38", "#733c2e"], "#9a5a44", "#5e3024"));
  const door = (c: number, arched: boolean) => cell(c, (x, y) => {
    pen.rect(x, y, 32, 32, "#2a1d14");
    for (let k = 0; k < 4; k++) pen.rect(x + 2 + k * 7, y + 2, 6, 30, ["#6a4a30", "#5e4129", "#74533a", "#654528"][k]!);
    if (arched) { pen.rect(x, y, 32, 6, "#2a1d14"); pen.rect(x + 4, y + 4, 24, 2, "#6a4a30"); pen.rect(x, y, 6, 8, "#2a1d14"); pen.rect(x + 26, y, 6, 8, "#2a1d14"); }
    pen.rect(x + 2, y + 10, 28, 2, "#3b3733"); pen.rect(x + 2, y + 24, 28, 2, "#3b3733");
    pen.rect(x + 24, y + 17, 3, 3, "#c9a24a");
  });
  door(CELL.door, false);
  door(CELL.doorArched, true);
  cell(CELL.window, (x, y) => {
    pen.rect(x, y, 32, 32, "#3a2a1e");
    for (const [wx, wy] of [[3, 3], [17, 3], [3, 17], [17, 17]] as const) {
      pen.rect(x + wx, y + wy, 12, 12, "#2e3a4a");
      pen.rect(x + wx, y + wy, 5, 5, "#56708a");
      pen.rect(x + wx + 1, y + wy + 1, 2, 2, "#8fb0c8");
    }
  });
  cell(CELL.shutter, (x, y) => {
    pen.rect(x, y, 32, 32, "#3c5a46");
    for (let k = 2; k < 32; k += 5) pen.rect(x + 2, y + k, 28, 2, "#2c4434");
    pen.rect(x, y, 2, 32, "#22352a"); pen.rect(x + 30, y, 2, 32, "#22352a");
  });
  cell(CELL.planter, (x, y) => {
    pen.rect(x, y, 32, 32, "#5e4129");
    for (let k = 0; k < 32; k += 8) pen.rect(x + k, y, 1, 32, "#3e2a1c");
    pen.rect(x, y, 32, 3, "#74533a");
  });
  cell(CELL.bloom, (x, y) => {
    pen.rect(x, y, 32, 32, "#3d6a34");
    for (let i = 0; i < 40; i++) pen.rect(x + rand() * 30, y + rand() * 30, 3, 3, tones(["#c0392b", "#e8dcc0", "#d6b45a", "#b05fa8", "#5a8a3a"]));
  });
  cell(CELL.lantern, (x, y) => {
    pen.rect(x, y, 32, 32, "#2b2724");
    pen.rect(x + 5, y + 5, 22, 22, "#f3c76a");
    pen.rect(x + 9, y + 9, 8, 14, "#fff0b8");
  });
  cell(CELL.banner, (x, y) => {
    pen.rect(x, y, 32, 32, "#7a1f24");
    pen.rect(x, y, 3, 32, "#d2a64a"); pen.rect(x + 29, y, 3, 32, "#d2a64a");
    pen.rect(x + 10, y + 8, 12, 2, "#d2a64a"); pen.rect(x + 15, y + 4, 2, 20, "#d2a64a");
    pen.rect(x + 11, y + 14, 10, 6, "#e0bb5c"); pen.rect(x + 13, y + 16, 6, 2, "#7a1f24");
    for (let k = 0; k < 4; k++) pen.rect(x + 4 + k * 7, y + 29, 4, 3, "#5a161a");
  });
  cell(CELL.shaft, (x, y) => {
    pen.rect(x, y, 32, 32, "#c7c0b2");
    for (let k = 0; k < 32; k += 8) { pen.rect(x + k, y, 2, 32, "#a39c8f"); pen.rect(x + k + 2, y, 1, 32, "#ddd6c8"); }
  });
  cell(CELL.marble, (x, y) => {
    pen.rect(x, y, 32, 32, "#b8b0a2");
    for (let i = 0; i < 6; i++) { const vx = rand() * 28, vy = rand() * 28; pen.rect(x + vx, y + vy, 4, 1, "#9a9284"); pen.rect(x + vx + 3, y + vy + 1, 3, 1, "#9a9284"); }
    pen.rect(x, y, 32, 2, "#d0c9bb");
  });
  cell(CELL.iron, (x, y) => { pen.rect(x, y, 32, 32, "#2f2c2a"); pen.rect(x, y, 32, 4, "#4a4643"); });
  cell(CELL.slit, (x, y) => { pen.rect(x, y, 32, 32, "#3a3540"); pen.rect(x + 8, y + 2, 16, 28, "#14121a"); });
  const signs: ((x: number, y: number) => void)[] = [
    (x, y) => { pen.rect(x + 10, y + 9, 12, 14, "#c9a24a"); pen.rect(x + 22, y + 12, 4, 7, "#c9a24a"); pen.rect(x + 11, y + 7, 10, 3, "#efe6cf"); },
    (x, y) => { pen.disc(x + 16, y + 17, 8, "#c88a3e"); pen.rect(x + 10, y + 14, 12, 1, "#8a5a2a"); pen.rect(x + 10, y + 19, 12, 1, "#8a5a2a"); },
    (x, y) => { pen.rect(x + 8, y + 18, 16, 6, "#7d766d"); pen.rect(x + 12, y + 12, 8, 6, "#7d766d"); pen.rect(x + 6, y + 18, 4, 3, "#7d766d"); },
    (x, y) => { pen.rect(x + 14, y + 6, 4, 10, "#7fd3c4"); pen.disc(x + 16, y + 20, 6, "#7fd3c4"); pen.rect(x + 13, y + 4, 6, 3, "#d9d2bd"); },
  ];
  signs.forEach((draw, k) => cell(CELL.sign + k, (x, y) => {
    pen.rect(x, y, 32, 32, "#5e4129"); pen.rect(x + 2, y + 2, 28, 28, "#7a5a3a"); draw(x, y);
  }));
}

function paintGlow(pen: Pen): void {
  pen.rect(0, 0, CELL_PX * CELLS_ACROSS, CELL_PX * CELLS_ACROSS, "#000000");
  const [wx, wy] = at(CELL.window), [lx, ly] = at(CELL.lantern);
  for (const [x, y] of [[3, 3], [17, 3], [3, 17], [17, 17]] as const) pen.rect(wx + x, wy + y, 12, 12, "#3a2810");
  pen.rect(lx + 5, ly + 5, 22, 22, "#d8a040");
  pen.rect(lx + 9, ly + 9, 8, 14, "#ffe2a0");
}
