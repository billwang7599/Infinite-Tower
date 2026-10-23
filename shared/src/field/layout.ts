/**
 * Field (2D map) levels: the part of a level the client is allowed to see, plus the walking rules.
 * The server owns levels (server/src/levels) and sends the layout when you enter one. Walking is
 * shared so the client can predict its own movement and the server can replay the same inputs.
 * Units are tiles; +z is up on screen, +x is right.
 */
import type { Vec2 } from "../core/math.js";

export interface Rect { x: number; z: number; w: number; h: number }

export interface LevelLayout {
  id: string;
  name: string;
  /** Which client renderer draws it (client/src/levels). */
  theme: "grass-field";
  /** The level spans x ∈ [-halfWidth, halfWidth], z ∈ [-halfDepth, halfDepth]; a border sits on the edge. */
  halfWidth: number;
  halfDepth: number;
  /** Walkable area stops this far inside the edge. */
  border: number;
  playerSpeed: number;
  /** Tall-grass patches (min corner + size): walking through them can start an encounter. */
  grass: Rect[];
}

export interface WalkInput { moveX: number; moveZ: number }

export function inRect(r: Rect, x: number, z: number): boolean {
  return x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.h;
}

export function inTallGrass(level: LevelLayout, x: number, z: number): boolean {
  return level.grass.some((g) => inRect(g, x, z));
}

export function clampToLevel(level: LevelLayout, pos: Vec2): void {
  const mx = level.halfWidth - level.border, mz = level.halfDepth - level.border;
  pos.x = Math.max(-mx, Math.min(mx, pos.x));
  pos.z = Math.max(-mz, Math.min(mz, pos.z));
}

/** Move `pos` one step by an input. Returns the velocity used. Must stay deterministic (client prediction). */
export function stepWalker(level: LevelLayout, pos: Vec2, input: WalkInput, dt: number): { vx: number; vz: number } {
  let ix = Math.max(-1, Math.min(1, input.moveX)), iz = Math.max(-1, Math.min(1, input.moveZ));
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const vx = ix * level.playerSpeed, vz = iz * level.playerSpeed;
  pos.x += vx * dt;
  pos.z += vz * dt;
  clampToLevel(level, pos);
  return { vx, vz };
}
