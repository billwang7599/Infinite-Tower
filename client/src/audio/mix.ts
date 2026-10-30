import { clamp, type Vec2 } from "@infinite-tower/shared";
import type { Volumes } from "../settings/audio.js";
import type { Bus } from "./sounds.js";

// The yaw as the arena camera's: forward is (sin yaw, cos yaw).
export interface Ears { x: number; z: number; yaw: number }
// In the place's units: metres in the arena, tiles on the overworld.
export interface Hearing { near: number; far: number }

export const MAX_PAN = 0.8;

export function place(ears: Ears, at: Vec2 | null, hearing: Hearing, reach = 1): { gain: number; pan: number } {
  if (!at) return { gain: 1, pan: 0 };
  const dx = at.x - ears.x, dz = at.z - ears.z, d = Math.hypot(dx, dz);
  const near = hearing.near, far = Math.max(near, hearing.far * reach);
  const gain = d <= near ? 1 : d >= far ? 0 : ((far - d) / (far - near)) ** 2;
  const right = dx * Math.cos(ears.yaw) - dz * Math.sin(ears.yaw);
  return { gain, pan: clamp(right / Math.max(d, near), -1, 1) * MAX_PAN };
}

export const mixGain = (volumes: Volumes, bus: Bus, ...gains: number[]): number =>
  gains.reduce((total, g) => total * g, volumes.master * volumes[bus]);

// `tiles` by their south-west corners, each a tile wide (the water map's).
export function nearestWater(tiles: readonly Vec2[], from: Vec2): Vec2 | null {
  let best: Vec2 | null = null, bestD = Infinity;
  for (const t of tiles) {
    const x = clamp(from.x, t.x, t.x + 1), z = clamp(from.z, t.z, t.z + 1), d = Math.hypot(x - from.x, z - from.z);
    if (d < bestD) [best, bestD] = [{ x, z }, d];
  }
  return best;
}
