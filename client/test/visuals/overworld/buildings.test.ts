import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Scene, VertexBuffer, type Mesh } from "@babylonjs/core";
import type { Rect, WorldLayout } from "@infinite-tower/shared";
import { townArt } from "../../../src/visuals/overworld/buildings.js";
import { chunkScenery, type Ledge } from "../../../src/visuals/overworld/scenery.js";
import type { House } from "../../../src/visuals/overworld/town.js";
import { stubCanvas } from "../../fixtures/canvas.js";
import { testMap } from "../../fixtures/map.js";

stubCanvas();
const art = townArt(new Scene(new NullEngine()));

type P = readonly [number, number, number];
interface Tri { p: readonly [P, P, P]; uv: readonly [number, number][]; n: P; owner: string; face: number }

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: P, b: P): P => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: P): P => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

function trianglesOf(meshes: readonly Mesh[], owner: string): Tri[] {
  return meshes.filter((m) => !m.name.includes("water")).flatMap((m) => {
    const pos = m.getVerticesData(VertexBuffer.PositionKind)!, nrm = m.getVerticesData(VertexBuffer.NormalKind)!;
    const uvs = m.getVerticesData(VertexBuffer.UVKind)!, idx = m.getIndices()!, out: Tri[] = [];
    const at = (i: number): P => [pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!];
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
      out.push({
        p: [at(a), at(b), at(c)], uv: [a, b, c].map((i) => [uvs[i * 2]!, uvs[i * 2 + 1]!]),
        n: [nrm[a * 3]!, nrm[a * 3 + 1]!, nrm[a * 3 + 2]!], owner, face: Math.min(a, b, c),
      });
    }
    return out;
  });
}

function buildAll(map: WorldLayout, chunkTiles: number): Tri[] {
  const { bounds: b } = map, tris: Tri[] = [];
  for (let x = b.x; x < b.x + b.w; x += chunkTiles) {
    for (let z = b.z; z < b.z + b.h; z += chunkTiles) {
      for (const ledge of chunkScenery(map, { x, z, w: chunkTiles, h: chunkTiles }).ledges) {
        const meshes = art.build(map, ledge, "test");
        if (meshes) tris.push(...trianglesOf(meshes, `${ledge.look} ${JSON.stringify(ledge.rect)}`));
      }
    }
  }
  return tris;
}

const area2 = (poly: readonly (readonly [number, number])[]) =>
  poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]!; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;

function clip(subject: [number, number][], by: [number, number][]): [number, number][] {
  const ccw = area2(by) > 0 ? by : [...by].reverse();
  let out = subject;
  for (let i = 0; i < ccw.length && out.length > 0; i++) {
    const a = ccw[i]!, b = ccw[(i + 1) % ccw.length]!, inp = out;
    const side = (p: [number, number]) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    out = [];
    inp.forEach((p, k) => {
      const q = inp[(k + 1) % inp.length]!, sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) out.push([p[0] + ((q[0] - p[0]) * sp) / (sp - sq), p[1] + ((q[1] - p[1]) * sp) / (sp - sq)]);
    });
  }
  return out;
}

function fighting(tris: readonly Tri[]): string[] {
  const planes = new Map<string, { tri: Tri; n: P }[]>();
  for (const tri of tris) {
    const raw = cross(sub(tri.p[1], tri.p[0]), sub(tri.p[2], tri.p[0]));
    if (Math.hypot(...raw) < 1e-9) continue;
    let n = unit(raw);
    if (dot(n, tri.n) < 0) n = [-n[0], -n[1], -n[2]];
    const key = `${n.map((c) => c.toFixed(3)).join()}|${dot(n, tri.p[0]).toFixed(3)}`;
    planes.set(key, [...planes.get(key) ?? [], { tri, n }]);
  }
  const found = new Set<string>();
  for (const [key, list] of planes) {
    const axis = list[0]!.n.map(Math.abs).indexOf(Math.max(...list[0]!.n.map(Math.abs)));
    const flat = (t: Tri) => t.p.map((p) => p.filter((_, i) => i !== axis) as [number, number]);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!.tri, b = list[j]!.tri;
        if (a.owner === b.owner && a.face === b.face) continue;
        if (Math.abs(area2(clip(flat(a), flat(b)))) > 1e-4) found.add(`${a.owner} / ${b.owner} in plane ${key}`);
      }
    }
  }
  return [...found];
}

function hit(tris: readonly Tri[], from: P, dir: P): { dist: number; n: P } | null {
  let best: { dist: number; n: P } | null = null;
  for (const tri of tris) {
    const e1 = sub(tri.p[1], tri.p[0]), e2 = sub(tri.p[2], tri.p[0]), h = cross(dir, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(from, tri.p[0]), u = dot(s, h) / det, q = cross(s, e1), v = dot(dir, q) / det, dist = dot(e2, q) / det;
    if (u < 0 || v < 0 || u + v > 1 || dist <= 1e-6 || (best && dist >= best.dist)) continue;
    best = { dist, n: tri.n };
  }
  return best;
}

function pictureAt(tris: readonly Tri[], at: P, n: P): [number, number] {
  for (const tri of tris) {
    if (dot(tri.n, n) < 0.999 || Math.abs(dot(sub(at, tri.p[0]), n)) > 1e-6) continue;
    const e1 = sub(tri.p[1], tri.p[0]), e2 = sub(tri.p[2], tri.p[0]), s = sub(at, tri.p[0]);
    const d00 = dot(e1, e1), d01 = dot(e1, e2), d11 = dot(e2, e2), d20 = dot(s, e1), d21 = dot(s, e2);
    const den = d00 * d11 - d01 * d01, v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
    if (Math.abs(den) < 1e-12 || v < -1e-9 || w < -1e-9 || v + w > 1 + 1e-9) continue;
    const [a, b, c] = tri.uv;
    return [a![0] + v * (b![0] - a![0]) + w * (c![0] - a![0]), a![1] + v * (b![1] - a![1]) + w * (c![1] - a![1])];
  }
  throw new Error(`no face at ${at.join()}`);
}

const house = (rect: Rect, look: Partial<House>, topY: number): Ledge => ({
  rect, topY, look: "house",
  house: {
    walls: "timber", roof: "red", ridge: "z", wallY: 2.7, door: null, chimney: false, sign: null, flowers: true,
    lantern: false, use: null, ...look,
  },
});

describe("the town's buildings", () => {
  const CITY = testMap([
    "WWWWWWWWWWWWWW;;;;WWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWW;;;;WWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWW;;;;WWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWW;;;;WWWWWWWWWWWWWW",
    "WW;;;;;;;;;WWW;;;;WWW;;;;;;;;;WW",
    "WW;;;;;;;;;WWW;;;;WWW;;;;;;;;;WW",
    "WW;;;;;;;;;;;;;;;;;;;;;;;;;;;;WW",
    "WW;HHHHHHHHHHHH;;;;;;;HHHHHHH;WW",
    "WW;HHHHHHHHHHHH;;;;;;;HHHHHHH;WW",
    "WW;HHHHHHHHHHHH;;;;;;;HHHHHHH;WW",
    "WW;HHHHHHHHHHHH;;;;;;;HHHHHHH;WW",
    "WW;HHHHHHHHHHHH;;;;;;;HHHHHHH;WW",
    "WW;;;;;;;;;;;;;;;;;;;;;;;;;;;;WW",
    "WW;H____H;;;;;;;;;;;;;;;;;;;;;WW",
    "WW;H____H;;;;;;;;;;;;;;WW;;;;;WW",
    "WW;HH__HH;;;;;;;;;;;;;;WW;;;;;WW",
    "WW;;;;;;;;;;;;;;;;;;;;;;;;;;;;WW",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  ], "kingdom");
  const tris = buildAll(CITY, 8);

  test("no two of their faces lie over each other facing the same way, cut across chunks as they are", () => {
    assert.ok(tris.some((t) => t.owner.startsWith("gate")) && tris.some((t) => t.owner.startsWith("house")));
    assert.deepEqual(fighting(tris), []);
  });

  test("a wall's plinth and the band under its top are closed above, not open slots", () => {
    const x = -12.5, faceZ = -8, topY = groundY(tris, x, faceZ - 0.5);
    for (const [y, out] of [[1, 0.04], [topY - 0.05, 0.03]] as const) {
      const below = hit(tris, [x, y, faceZ + out], [0, -1, 0]);
      assert.ok(below && below.n[1] > 0.99 && below.dist < 0.6, `nothing closes the band under ${y}`);
    }
  });

  test("the arch over a gate is closed underneath, seen from the way through it", () => {
    const up = hit(tris, [0, 1, 3.5], [0, 1, 0]);
    assert.ok(up && up.n[1] < -0.99, JSON.stringify(up));
  });

  test("the battlements are cut from stone the wall's size, not one picture squeezed onto each", () => {
    const wall = tris.filter((t) => t.owner.startsWith("castle"));
    const [face] = wall.filter((t) => t.n[2] > 0.99 && t.p.every((p) => p[2] === -8));
    const cell = (t: Tri) => t.uv.map(([u, v]) => `${Math.floor(u * 8)},${Math.floor(v * 8)}`)[0];
    const scale = (t: Tri) => Math.hypot(t.uv[1]![0] - t.uv[0]![0], t.uv[1]![1] - t.uv[0]![1]) / Math.hypot(...sub(t.p[1], t.p[0]));
    const stone = wall.filter((t) => cell(t) === cell(face!) && Math.hypot(...sub(t.p[1], t.p[0])) > 0.1);
    for (const t of stone) assert.ok(Math.abs(scale(t) / scale(face!) - 1) < 0.1, `${t.p.join(" ")}: ${scale(t)} vs ${scale(face!)}`);
  });
});

describe("a house", () => {
  const map = testMap(Array.from({ length: 12 }, () => ";".repeat(16)), "kingdom");
  const tall = house({ x: -3, z: -3, w: 5, h: 6 }, { ridge: "z", wallY: 2.7 }, 2.7 + 2.1);
  const tris = trianglesOf(art.build(map, tall, "house")!, "house");
  const north: P = [0, 0, 1], gableZ = 3;

  test("its gable carries on the wall's picture under it, without a seam where they meet", () => {
    for (const x of [-2.6, -1.3, -0.4, 0.9]) {
      const [u0, v0] = pictureAt(tris, [x, 2.69, gableZ], north), [u1, v1] = pictureAt(tris, [x, 2.71, gableZ], north);
      assert.ok(Math.abs(u1 - u0) < 1e-4 && Math.abs(v1 - v0 - 0.02 / 16) < 1e-4, `at ${x}: ${[u0, v0]} then ${[u1, v1]}`);
    }
  });

  test("its gable's picture isn't squashed toward the top, however tall the roof", () => {
    const [, v0] = pictureAt(tris, [-0.5, 4.72, gableZ], north), [, v1] = pictureAt(tris, [-0.5, 4.78, gableZ], north);
    assert.ok(Math.abs(v1 - v0 - 0.06 / 16) < 1e-4, `${v0} to ${v1}`);
  });

  test("the roof's overhang is closed underneath", () => {
    for (const from of [[-0.5, 1, -3.15], [-0.5, 1, 3.15], [-3.15, 1, -1], [2.15, 1, -1]] as const) {
      const up = hit(tris, from, [0, 1, 0]);
      assert.ok(up && up.n[1] < 0, `${from}: ${JSON.stringify(up)}`);
    }
  });

  test("two houses side by side in a row neither overhang nor fight over the wall they share", () => {
    const terrace = testMap(Array.from({ length: 12 }, (_, r) => (r >= 4 && r <= 8 ? ";;;HHHHHHHHHH;;;" : ";".repeat(16))), "kingdom");
    const row = [house({ x: -5, z: -3, w: 5, h: 5 }, { ridge: "x" }, 4.8), house({ x: 0, z: -3, w: 5, h: 5 }, { ridge: "x" }, 4.8)];
    const both = row.flatMap((l, i) => trianglesOf(art.build(terrace, l, `row-${i}`)!, `house ${i}`));
    assert.deepEqual(fighting(both), []);
  });
});

function groundY(tris: readonly Tri[], x: number, z: number): number {
  const down = hit(tris, [x, 100, z], [0, -1, 0]);
  return down ? 100 - down.dist : 0;
}
