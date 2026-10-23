/**
 * Small engine-free math helpers.
 * Yaw convention everywhere: yaw 0 faces +z, forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw).
 */

export interface Vec3 { x: number; y: number; z: number }
export interface Vec2 { x: number; z: number }

/** Move `current` toward `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  return current < target ? Math.min(current + maxDelta, target) : Math.max(current - maxDelta, target);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Wrap an angle into (-π, π]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Turn angle `current` toward `target` the short way round, by at most `maxStep`. */
export function turnToward(current: number, target: number, maxStep: number): number {
  return current + clamp(wrapAngle(target - current), -maxStep, maxStep);
}

/**
 * Frame-rate independent smoothing: the fraction of the remaining gap to close this frame.
 * Higher `rate` = snappier (about 1/rate seconds to close most of the gap).
 */
export function dampFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/** Ease `current` toward `target` (see dampFactor). */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * dampFactor(rate, dt);
}

export function roundTo(x: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(x * scale) / scale;
}

/** Distance between two points on the ground plane (y ignored). */
export function distXZ(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** Deterministic pseudo-random (mulberry32): same seed, same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
