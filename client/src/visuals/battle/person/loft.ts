import { Mesh, VertexData, type Scene } from "@babylonjs/core";

/** A cross-section: its height, half-width and half-depth, and how far its middle sits off the axis. */
export interface Section { y: number; x: number; z: number; dz?: number; dx?: number }

export const RING_POINTS = 12;
/** Above 2 the ring squares off: a torso, not a pipe. */
const ROUNDNESS = 2.6;

const signedPow = (v: number, p: number) => Math.sign(v) * Math.abs(v) ** p;

/** Sections bottom to top. */
export function loft(
  scene: Scene, name: string, sections: readonly Section[], roundness = ROUNDNESS, uRepeat = 1,
): Mesh {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const ring = RING_POINTS + 1;
  sections.forEach((s, i) => {
    for (let k = 0; k < ring; k++) {
      const a = (2 * Math.PI * k) / RING_POINTS;
      positions.push(
        (s.dx ?? 0) + s.x * signedPow(Math.sin(a), 2 / roundness), s.y,
        (s.dz ?? 0) + s.z * signedPow(Math.cos(a), 2 / roundness),
      );
      uvs.push((k / RING_POINTS) * uRepeat, i / Math.max(1, sections.length - 1));
    }
  });
  for (let i = 0; i + 1 < sections.length; i++) {
    for (let k = 0; k < RING_POINTS; k++) {
      const a = i * ring + k, b = a + ring;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  for (const [s, end, up] of [[sections[0]!, 0, false], [sections.at(-1)!, sections.length - 1, true]] as const) {
    const middle = positions.length / 3;
    positions.push(s.dx ?? 0, s.y, s.dz ?? 0);
    uvs.push(0.5, end / Math.max(1, sections.length - 1));
    for (let k = 0; k < RING_POINTS; k++) {
      const a = end * ring + k;
      if (up) indices.push(middle, a + 1, a);
      else indices.push(middle, a, a + 1);
    }
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = Object.assign(new VertexData(), { positions, indices, normals, uvs });
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  return mesh;
}

export function sectionAt(sections: readonly Section[], y: number): Section {
  const i = sections.findIndex((s) => s.y >= y);
  if (i <= 0) return sections[Math.max(0, i)] ?? sections.at(-1)!;
  const a = sections[i - 1]!, b = sections[i]!, t = (y - a.y) / (b.y - a.y);
  const mix = (p: number, q: number) => p + (q - p) * t;
  return { y, x: mix(a.x, b.x), z: mix(a.z, b.z), dz: mix(a.dz ?? 0, b.dz ?? 0), dx: mix(a.dx ?? 0, b.dx ?? 0) };
}
