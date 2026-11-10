import { dampFactor, distXZ, type Vec2 } from "@infinite-tower/shared";
import { VIEWS } from "../../gfx/look/art.js";

const HOP_RATE_RAD_PER_SEC = 12;
const HOP_TILES = 0.12;
const BREATH_PERIOD_TIME = 2.4;
/** The share of a breath spent drawn a pixel up. */
const BREATH_IN_SHARE = 0.4;

/** Server snapshots come every 3 ticks: each is led on along its velocity until the next, then eased toward. */
const GLIDE_RATE = 16;
const MAX_LEAD_TIME = 0.1;
const SNAP_DIST_TILES = 3;

/** The walk hop's phase, kept within one hop; on stopping it lands the short way instead of dropping. */
export function stepHop(phase: number, moving: boolean, dt: number): number {
  const by = dt * HOP_RATE_RAD_PER_SEC;
  if (moving) return (phase + by) % Math.PI;
  if (phase === 0) return 0;
  if (phase < Math.PI / 2) return Math.max(0, phase - by);
  const next = phase + by;
  return next >= Math.PI ? 0 : next;
}

export const hopTiles = (phase: number): number => Math.abs(Math.sin(phase)) * HOP_TILES;

export const stepped = (from: Vec2, to: Vec2, fraction: number): Vec2 =>
  ({ x: from.x + (to.x - from.x) * fraction, z: from.z + (to.z - from.z) * fraction });

export interface Glide {
  drawn: Vec2;
  last: Vec2;
  sinceSnapTime: number;
}

export function glide(g: Glide, snapped: Vec2, vel: { vx: number; vz: number }, dt: number): void {
  if (snapped.x !== g.last.x || snapped.z !== g.last.z) {
    g.last = { x: snapped.x, z: snapped.z };
    g.sinceSnapTime = 0;
  } else {
    g.sinceSnapTime += dt;
  }
  if (distXZ(g.drawn, snapped) > SNAP_DIST_TILES) {
    g.drawn = { x: snapped.x, z: snapped.z };
    return;
  }
  const lead = Math.min(g.sinceSnapTime, MAX_LEAD_TIME), k = dampFactor(GLIDE_RATE, dt);
  g.drawn.x += (snapped.x + vel.vx * lead - g.drawn.x) * k;
  g.drawn.z += (snapped.z + vel.vz * lead - g.drawn.z) * k;
}

export function breathLiftTiles(time: number, seed: number, sizeTiles: number, moving: boolean): number {
  if (moving) return 0;
  const cycle = (time / BREATH_PERIOD_TIME + seed * 0.618) % 1;
  return cycle < BREATH_IN_SHARE ? sizeTiles / VIEWS.chibi.height : 0;
}
