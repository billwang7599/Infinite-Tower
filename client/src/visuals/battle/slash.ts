import { Mesh, VertexBuffer, VertexData, type Material, type Scene } from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";
import { keepSharp } from "./pixel.js";

export const TRAIL_TIME = 0.15;
const MAX_SAMPLES = 40;
const HILT_ALPHA = 0.2;

export interface TrailSample { time: number; base: Vec3; tip: Vec3; alpha: number }
export interface Trail { samples: TrailSample[]; broken: boolean }

export const newTrail = (): Trail => ({ samples: [], broken: false });

export function sampleTrail(trail: Trail, time: number, edge: { base: Vec3; tip: Vec3 } | null, alpha: number): void {
  const { samples } = trail;
  if (edge && trail.broken) samples.length = 0;
  trail.broken = !edge;
  if (edge) samples.push({ time, ...edge, alpha });
  const old = samples.findIndex((s) => time - s.time <= TRAIL_TIME + 1e-9);
  samples.splice(0, old < 0 ? samples.length : Math.max(old, samples.length - MAX_SAMPLES));
}

export const trailAlpha = (sample: TrailSample, time: number): number =>
  sample.alpha * Math.max(0, 1 - (time - sample.time) / TRAIL_TIME);

export interface Slash { mesh: Mesh; trail: Trail; time: number; positions: Float32Array; colors: Float32Array }

export function buildSlash(scene: Scene, name: string, material: Material): Slash {
  const positions = new Float32Array(MAX_SAMPLES * 2 * 3), colors = new Float32Array(MAX_SAMPLES * 2 * 4).fill(1);
  const indices: number[] = [];
  for (let i = 0; i < MAX_SAMPLES - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const mesh = new Mesh(`slash-${name}`, scene), data = new VertexData();
  Object.assign(data, { positions, colors, indices });
  data.applyToMesh(mesh, true);
  mesh.material = material;
  mesh.hasVertexAlpha = true;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = 1;
  mesh.setEnabled(false);
  keepSharp(mesh);
  return { mesh, trail: newTrail(), time: 0, positions, colors };
}

export function placeSlash(
  slash: Slash, visibility: number | null, edge: { base: Vec3; tip: Vec3 } | null, dt: number,
): void {
  slash.time += dt;
  sampleTrail(slash.trail, slash.time, visibility === null ? null : edge, visibility ?? 0);
  const { samples } = slash.trail, { positions, colors } = slash;
  slash.mesh.setEnabled(samples.length >= 2);
  if (samples.length < 2) return;
  for (let i = 0; i < MAX_SAMPLES; i++) {
    const s = samples[Math.min(i, samples.length - 1)]!, alpha = i < samples.length ? trailAlpha(s, slash.time) : 0;
    positions.set([s.base.x, s.base.y, s.base.z, s.tip.x, s.tip.y, s.tip.z], i * 6);
    colors[i * 8 + 3] = alpha * HILT_ALPHA;
    colors[i * 8 + 7] = alpha;
  }
  slash.mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  slash.mesh.updateVerticesData(VertexBuffer.ColorKind, colors);
}
