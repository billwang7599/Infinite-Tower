/**
 * The part of an overworld level the client may see, and the walking rules: shared, so the client predicts its
 * walking and the server replays the same inputs. Units are tiles; +z is up on screen, +x is right.
 */
import { clamp, distXZ, type Vec2 } from "../core/math.js";
import { isSolid, mapHalfSize } from "./tiles.js";

export interface Rect { x: number; z: number; w: number; h: number }

export interface LevelLayout {
  id: string;
  name: string;
  /** The tower floor it's on, shown before its name. */
  floor: number;
  /** Which client look draws it. */
  theme: "grass-field";
  /** Rows of tile characters (`TILES`), north (+z) first, one character a tile; the map is centred on 0, 0. */
  tiles: string[];
  playerSpeed: number;
  /** Campfire centers. Standing within REST_RANGE_TILES of one, you can rest: HP and stamina refill. */
  campfires: Vec2[];
}

/** Center to center. */
export const REST_RANGE_TILES = 1.6;
export const JOIN_RANGE_TILES = 1.6;

/**
 * Close enough to a campfire to rest. The server adds `slack`: its copy of you trails the client's prediction by
 * a round trip, so a player who just walked up would otherwise be refused.
 */
export function nearCampfire(level: LevelLayout, pos: Vec2, slack = 0): boolean {
  return level.campfires.some((c) => distXZ(c, pos) <= REST_RANGE_TILES + slack);
}

export interface WalkInput { moveX: number; moveZ: number }

export function inRect(r: Rect, x: number, z: number): boolean {
  return x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.h;
}

/** Tiles per second. */
export interface Velocity2 { vx: number; vz: number }

export interface WalkOptions {
  /** Written with the velocity used. */
  vel?: Velocity2;
  /** Share of the level's `playerSpeed` (`walkPace`: an overloaded bag walks at half). The server decides it. */
  pace?: number;
}

/** Half the side of the square a walker takes up against solid tiles. */
export const WALKER_RADIUS = 0.3;
/** Longer moves go in steps of this, so none can jump a tile. */
const MAX_STEP_TILES = 0.5;
const EDGE_EPS = 1e-6;

/** x then z, each stopped flush at a solid tile, so walkers slide along walls. Client and server both run it. */
export function moveWalker(level: LevelLayout, pos: Vec2, dx: number, dz: number): void {
  const { halfWidth, halfDepth } = mapHalfSize(level);
  const hits = (x: number, z: number) => {
    const r = WALKER_RADIUS - EDGE_EPS, gx = x + halfWidth, gz = halfDepth - z;
    for (let row = Math.floor(gz - r); row <= Math.floor(gz + r); row++) {
      for (let col = Math.floor(gx - r); col <= Math.floor(gx + r); col++) {
        if (isSolid(level, col - halfWidth + 0.5, halfDepth - row - 0.5)) return true;
      }
    }
    return false;
  };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / MAX_STEP_TILES));
  for (let i = 0; i < steps; i++) {
    pos.x = slide(pos.x, dx / steps, -halfWidth, (x) => hits(x, pos.z));
    pos.z = slide(pos.z, dz / steps, -halfDepth, (z) => hits(pos.x, z));
  }
}

/** Tile edges lie on `origin` + whole numbers. One already caught in a solid tile moves freely, so it can get out. */
function slide(at: number, d: number, origin: number, hits: (at: number) => boolean): number {
  const to = at + d;
  if (d === 0 || !hits(to) || hits(at)) return to;
  const g = at - origin;
  return d > 0
    ? Math.max(at, origin + Math.ceil(g + WALKER_RADIUS - EDGE_EPS) - WALKER_RADIUS)
    : Math.min(at, origin + Math.floor(g - WALKER_RADIUS + EDGE_EPS) + WALKER_RADIUS);
}

export function stepWalker(level: LevelLayout, pos: Vec2, input: WalkInput, dt: number, opts: WalkOptions = {}): void {
  let ix = clamp(input.moveX, -1, 1), iz = clamp(input.moveZ, -1, 1);
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const speed = level.playerSpeed * (opts.pace ?? 1);
  const vx = ix * speed, vz = iz * speed;
  moveWalker(level, pos, vx * dt, vz * dt);
  if (opts.vel) { opts.vel.vx = vx; opts.vel.vz = vz; }
}
