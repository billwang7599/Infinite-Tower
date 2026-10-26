/**
 * Field (2D map) levels: the part of a level the client is allowed to see, plus the walking rules.
 * The server owns levels (server/src/core/levels) and sends the layout when you enter one. Walking is
 * shared so the client can predict its own movement and the server can replay the same inputs.
 * Units are tiles; +z is up on screen, +x is right.
 */
import { clamp, distXZ, type Vec2 } from "../core/math.js";

export interface Rect { x: number; z: number; w: number; h: number }

export interface LevelLayout {
  id: string;
  name: string;
  /** Which client renderer draws it (client/src/field/levels). */
  theme: "grass-field";
  /** The level spans x ∈ [-halfWidth, halfWidth], z ∈ [-halfDepth, halfDepth]; a border sits on the edge. */
  halfWidth: number;
  halfDepth: number;
  /** Walkable area stops this far inside the edge. */
  border: number;
  playerSpeed: number;
  /** Tall-grass patches (min corner + size): walking through them can start an encounter. */
  grass: Rect[];
  /** Campfire centers. Standing within REST_RANGE of one, you can rest: HP and stamina refill. */
  campfires: Vec2[];
}

/** Tiles, center to center. */
export const REST_RANGE = 1.6;

/**
 * Close enough to a campfire to rest. The server adds `slack`: its copy of you trails the client's prediction by
 * a round trip, so a player who just walked up would otherwise be refused.
 */
export function nearCampfire(level: LevelLayout, pos: Vec2, slack = 0): boolean {
  return level.campfires.some((c) => distXZ(c, pos) <= REST_RANGE + slack);
}

export interface WalkInput { moveX: number; moveZ: number }

export function inRect(r: Rect, x: number, z: number): boolean {
  return x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.h;
}

export function inTallGrass(level: LevelLayout, x: number, z: number): boolean {
  return level.grass.some((g) => inRect(g, x, z));
}

export function clampToLevel(level: LevelLayout, pos: Vec2): void {
  const maxX = level.halfWidth - level.border, maxZ = level.halfDepth - level.border;
  pos.x = clamp(pos.x, -maxX, maxX);
  pos.z = clamp(pos.z, -maxZ, maxZ);
}

/** Tiles per second. */
export interface Velocity2 { vx: number; vz: number }

export interface WalkOptions {
  /** Written with the velocity used. */
  vel?: Velocity2;
  /** Share of the level's `playerSpeed` (`walkPace`: an overloaded bag walks at half). The server decides it. */
  pace?: number;
}

/**
 * Move `pos` one step by an input. Must stay deterministic: the client predicts with it and the server replays the
 * same inputs.
 */
export function stepWalker(level: LevelLayout, pos: Vec2, input: WalkInput, dt: number, opts: WalkOptions = {}): void {
  let ix = clamp(input.moveX, -1, 1), iz = clamp(input.moveZ, -1, 1);
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const speed = level.playerSpeed * (opts.pace ?? 1);
  const vx = ix * speed, vz = iz * speed;
  pos.x += vx * dt;
  pos.z += vz * dt;
  clampToLevel(level, pos);
  if (opts.vel) { opts.vel.vx = vx; opts.vel.vz = vz; }
}
