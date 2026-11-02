import { inRect, isSolid, mapHalfSize, type LevelMap, type Rect, type Vec3 } from "@infinite-tower/shared";

export type PropKind =
  | "tree" | "pine" | "deadTree" | "bush" | "rock" | "ruin" | "tuft" | "flowers" | "tallGrass" | "reeds" | "mushrooms"
  | "produce" | "potions" | "scales" | "embers" | "dummy" | "rubble" | "crane" | "cart" | "scrub" | "chips"
  | "shack";

export interface Prop { kind: PropKind; x: number; y: number; z: number; scale: number }

export interface Awning { colors: readonly [string, string]; topY: number }

export interface Ledge {
  rect: Rect; topY: number; look?: "castle" | "house" | "counter" | "hearth" | "quarry"; awning?: Awning;
}

export interface Scenery {
  /** The level's own ground first (top 0), then the ledges round it. */
  ledges: Ledge[];
  props: Prop[];
}

/** Tiles past the level's edge the scenery reaches: more than the camera can show. */
export const SCENERY_REACH_TILES = 16;
/** Props stand at least this far from a gap's sides. */
const GAP_CLEARANCE_TILES = 0.8;

const TALL = new Set<PropKind>([
  "tree", "pine", "deadTree", "bush", "rock", "ruin", "rubble", "crane", "cart", "shack",
]);

export function isTall(kind: PropKind): boolean {
  return TALL.has(kind);
}

export function groundY(ledges: readonly Ledge[], x: number, z: number): number {
  let y = -Infinity;
  for (const l of ledges) if (inRect(l.rect, x, z) && l.topY > y) y = l.topY;
  return y === -Infinity ? 0 : y;
}

/** The chibi's own extent inside its larger sprite quad. */
const WALKER_VIEW = { halfWidthTiles: 0.4, heightTiles: 1.3 };

export function hidesWalker(ledge: Ledge, eye: Vec3, feet: Vec3): boolean {
  const away = Math.hypot(feet.x - eye.x, feet.z - eye.z) || 1;
  const rightX = (feet.z - eye.z) / away, rightZ = (eye.x - feet.x) / away;
  const topY = ledge.awning?.topY ?? ledge.topY;
  return [0, WALKER_VIEW.heightTiles].some((up) => [-1, 0, 1].some((side) => blocksView(ledge.rect, topY, eye, {
    x: feet.x + rightX * side * WALKER_VIEW.halfWidthTiles,
    y: feet.y + up,
    z: feet.z + rightZ * side * WALKER_VIEW.halfWidthTiles,
  })));
}

function blocksView(rect: Rect, topY: number, from: Vec3, to: Vec3): boolean {
  if (topY <= 0) return false;
  let t0 = 0, t1 = 1;
  const slabs: [number, number, number, number][] = [
    [from.x, to.x, rect.x, rect.x + rect.w], [from.y, to.y, -Infinity, topY], [from.z, to.z, rect.z, rect.z + rect.h],
  ];
  for (const [a, b, lo, hi] of slabs) {
    const d = b - a;
    if (d === 0) {
      if (a < lo || a > hi) return false;
      continue;
    }
    const s0 = (lo - a) / d, s1 = (hi - a) / d;
    t0 = Math.max(t0, Math.min(s0, s1));
    t1 = Math.min(t1, Math.max(s0, s1));
    if (t0 > t1) return false;
  }
  return true;
}

export function openExits(scenery: Scenery, level: LevelMap): Scenery {
  const gaps = exitGaps(level);
  const [map, ...round] = scenery.ledges;
  const cut = (ledge: Ledge) => gaps
    .reduce((rects, gap) => rects.flatMap((r) => minus(r, gap)), [ledge.rect])
    .map((rect) => ({ ...ledge, rect }));
  const clear = gaps.map((g) => ({
    x: g.x - GAP_CLEARANCE_TILES, z: g.z - GAP_CLEARANCE_TILES,
    w: g.w + GAP_CLEARANCE_TILES * 2, h: g.h + GAP_CLEARANCE_TILES * 2,
  }));
  return {
    ledges: [map!, ...round.flatMap(cut), ...gaps.map((rect) => ({ rect, topY: 0 }))],
    props: scenery.props.filter((p) => !clear.some((r) => inRect(r, p.x, p.z))),
  };
}

function exitGaps(level: LevelMap): Rect[] {
  const { halfWidth: L, halfDepth: D } = mapHalfSize(level), cols = L * 2, rows = D * 2;
  const reach = SCENERY_REACH_TILES, gaps: Rect[] = [];
  const open = (c: number, r: number) => !isSolid(level, c - L + 0.5, D - r - 0.5);
  const runs = (length: number, isOpen: (i: number) => boolean, gap: (from: number, n: number) => Rect) => {
    let from = -1;
    for (let i = 0; i <= length; i++) {
      const o = i < length && isOpen(i);
      if (o && from < 0) from = i;
      if (!o && from >= 0) {
        gaps.push(gap(from, i - from));
        from = -1;
      }
    }
  };
  runs(cols, (c) => open(c, 0), (c, n) => ({ x: c - L, z: D, w: n, h: reach }));
  runs(cols, (c) => open(c, rows - 1), (c, n) => ({ x: c - L, z: -D - reach, w: n, h: reach }));
  runs(rows, (r) => open(0, r), (r, n) => ({ x: -L - reach, z: D - r - n, w: reach, h: n }));
  runs(rows, (r) => open(cols - 1, r), (r, n) => ({ x: L, z: D - r - n, w: reach, h: n }));
  return gaps;
}

function minus(r: Rect, hole: Rect): Rect[] {
  const x0 = Math.max(r.x, hole.x), x1 = Math.min(r.x + r.w, hole.x + hole.w);
  const z0 = Math.max(r.z, hole.z), z1 = Math.min(r.z + r.h, hole.z + hole.h);
  if (x0 >= x1 || z0 >= z1) return [r];
  return [
    { x: r.x, z: r.z, w: x0 - r.x, h: r.h },
    { x: x1, z: r.z, w: r.x + r.w - x1, h: r.h },
    { x: x0, z: r.z, w: x1 - x0, h: z0 - r.z },
    { x: x0, z: z1, w: x1 - x0, h: r.z + r.h - z1 },
  ].filter((p) => p.w > 0 && p.h > 0);
}

export function tileBlocks(level: LevelMap, is: (x: number, z: number) => boolean): Rect[] {
  const { halfWidth: L, halfDepth: D } = mapHalfSize(level), cols = L * 2, rows = D * 2;
  const at = (c: number, r: number) => is(c - L + 0.5, D - r - 0.5);
  const taken = new Set<string>(), rects: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(c, r) || taken.has(`${c},${r}`)) continue;
      let w = 1, h = 1;
      while (c + w < cols && at(c + w, r) && !taken.has(`${c + w},${r}`)) w++;
      const rowMatches = (rr: number) => Array.from({ length: w }, (_, i) => c + i)
        .every((cc) => at(cc, rr) && !taken.has(`${cc},${rr}`));
      while (r + h < rows && rowMatches(r + h)) h++;
      for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) taken.add(`${cc},${rr}`);
      rects.push({ x: c - L, z: D - r - h, w, h });
    }
  }
  return rects;
}
