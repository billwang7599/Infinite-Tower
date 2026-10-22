/**
 * Deterministic tower layout. Same seed => same tower on every client and the server,
 * so floors never need to be sent over the network.
 */
import { TOWER } from "./constants.js";

export interface PlatformSpec {
  x: number; y: number; z: number;
  width: number; depth: number;
}

/** mulberry32: tiny seeded PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The guaranteed route: one platform per floor, zig-zagging left/right around a slowly
 * drifting center. The zig-zag keeps every route platform out from under the next one
 * (platforms are solid from below), and the slow drift keeps consecutive ones in reach.
 */
function routePosition(seed: number, floor: number): { x: number; z: number } {
  const p = (seed % 1000) * 0.37;
  const center = Math.sin(floor * 0.2 + p) * 2.5;
  const side = floor % 2 === 0 ? 1 : -1;
  return {
    x: center + side * 2,
    z: Math.cos(floor * 0.31 + p * 1.7) * TOWER.halfWidth * 0.25,
  };
}

/** Platforms for one floor. Floor 0 is the full-width ground floor. */
export function generateFloor(seed: number, floor: number): PlatformSpec[] {
  const y = floor * TOWER.floorHeight;
  const w = TOWER.halfWidth;
  if (floor === 0) return [{ x: 0, y, z: 0, width: w * 2, depth: w * 2 }];

  const rand = rng(seed * 100003 + floor * 7919);
  // Gets harder with height: smaller route platforms, fewer extras.
  const difficulty = Math.min(1, floor / 80);

  const route = routePosition(seed, floor);
  const out: PlatformSpec[] = [
    { x: route.x, y, z: route.z, width: 3 - difficulty * 1.2, depth: 2.4 - difficulty * 0.6 },
  ];

  // Optional side platforms (shortcuts, resting spots, or dead ends).
  const extras = rand() < 0.7 - difficulty * 0.4 ? 1 + Math.floor(rand() * 2) : 0;
  for (let i = 0; i < extras; i++) {
    const width = 1.6 + rand() * 1.6;
    const depth = 1.6 + rand() * 1.2;
    const x = (rand() * 2 - 1) * (w - width / 2 - 0.4);
    const z = (rand() * 2 - 1) * (w * 0.5 - depth / 2);
    // Keep clear of this floor's route platform and the airspace above the previous one.
    const prev = routePosition(seed, floor - 1);
    if (Math.abs(x - route.x) < 3.5 && Math.abs(z - route.z) < 2.5) continue;
    if (Math.abs(x - prev.x) < 3 && Math.abs(z - prev.z) < 2.5) continue;
    out.push({ x, y, z, width, depth });
  }
  return out;
}

export function floorAtHeight(y: number): number {
  return Math.max(0, Math.floor((y + 0.5) / TOWER.floorHeight));
}
