import { inRect, isSolid, mapHalfSize, type LevelLayout, type Rect } from "@infinite-tower/shared";

export type PropKind =
  | "tree" | "pine" | "deadTree" | "bush" | "rock" | "ruin" | "tuft" | "flowers" | "tallGrass" | "reeds" | "mushrooms";

export interface Prop { kind: PropKind; x: number; y: number; z: number; scale: number }

export interface Ledge { rect: Rect; topY: number }

export interface Scenery {
  /** The level's own ground first (top 0), then the ledges round it. */
  ledges: Ledge[];
  props: Prop[];
}

/** Tiles past the level's edge the scenery reaches: more than the camera can show. */
export const SCENERY_REACH_TILES = 16;
/** Props stand at least this far from a gap's sides. */
const GAP_CLEARANCE_TILES = 0.8;

const TALL = new Set<PropKind>(["tree", "pine", "deadTree", "bush", "rock", "ruin"]);

export function isTall(kind: PropKind): boolean {
  return TALL.has(kind);
}

export function groundY(ledges: readonly Ledge[], x: number, z: number): number {
  let y = -Infinity;
  for (const l of ledges) if (inRect(l.rect, x, z) && l.topY > y) y = l.topY;
  return y === -Infinity ? 0 : y;
}

export function openExits(scenery: Scenery, level: LevelLayout): Scenery {
  const gaps = exitGaps(level);
  const [map, ...round] = scenery.ledges;
  const cut = (ledge: Ledge) => gaps
    .reduce((rects, gap) => rects.flatMap((r) => minus(r, gap)), [ledge.rect])
    .map((rect) => ({ rect, topY: ledge.topY }));
  const clear = gaps.map((g) => ({
    x: g.x - GAP_CLEARANCE_TILES, z: g.z - GAP_CLEARANCE_TILES,
    w: g.w + GAP_CLEARANCE_TILES * 2, h: g.h + GAP_CLEARANCE_TILES * 2,
  }));
  return {
    ledges: [map!, ...round.flatMap(cut), ...gaps.map((rect) => ({ rect, topY: 0 }))],
    props: scenery.props.filter((p) => !clear.some((r) => inRect(r, p.x, p.z))),
  };
}

function exitGaps(level: LevelLayout): Rect[] {
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
