/**
 * Field (2D map) geometry and walking. The layout is content: the server owns it and sends it in
 * `welcome`. Walking is shared so the client can predict its own movement and the server can replay
 * the same inputs to check it. Units are tiles; +z is up on screen, +x is right.
 */
import type { Vec2 } from "../core/math.js";

export interface FieldLayout {
  /** The field spans x ∈ [-halfWidth, halfWidth], z ∈ [-halfDepth, halfDepth]; a tree border sits on the edge. */
  halfWidth: number;
  halfDepth: number;
  /** Walkable area stops this far inside the edge. */
  border: number;
  playerSpeed: number;
  spawn: Vec2;
  /** Tall grass patch (min corner + size). */
  grass: { x: number; z: number; w: number; h: number };
}

export interface WalkInput { moveX: number; moveZ: number }

export function inTallGrass(field: FieldLayout, x: number, z: number): boolean {
  const g = field.grass;
  return x >= g.x && x <= g.x + g.w && z >= g.z && z <= g.z + g.h;
}

export function clampToField(field: FieldLayout, pos: Vec2): void {
  const mx = field.halfWidth - field.border, mz = field.halfDepth - field.border;
  pos.x = Math.max(-mx, Math.min(mx, pos.x));
  pos.z = Math.max(-mz, Math.min(mz, pos.z));
}

/** Move `pos` one step by an input. Returns the velocity used. Must stay deterministic (client prediction). */
export function stepWalker(field: FieldLayout, pos: Vec2, input: WalkInput, dt: number): { vx: number; vz: number } {
  let ix = Math.max(-1, Math.min(1, input.moveX)), iz = Math.max(-1, Math.min(1, input.moveZ));
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const vx = ix * field.playerSpeed, vz = iz * field.playerSpeed;
  pos.x += vx * dt;
  pos.z += vz * dt;
  clampToField(field, pos);
  return { vx, vz };
}
