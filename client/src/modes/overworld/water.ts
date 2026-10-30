import { clamp, mapHalfSize, tileAt, TILES, type LevelLayout, type TileKind } from "@infinite-tower/shared";

/** Below the ground beside it: the surface, and the bed below the surface at the bank and at its deepest. */
export const WATER_DEPTH_TILES = { surface: 0.12, bank: 0.3, deep: 1.1 };
const SLOPE_TILES = 2.5;
/** Water up to `fullSpeedWidth` wide runs at full speed, wider in step slower; `atBankShare` of it at the bank. */
const FLOW = { tilesPerSec: 0.9, fullSpeedWidthTiles: 2, atBankShare: 0.4 };
const SHORE_CAP_TILES = 5;
const SOLVE = { maxSweeps: 4000, overRelax: 1.8, doneBelow: 1e-7 };

export interface WaterPoint { flowX: number; flowZ: number; shore: number; depth: number }

interface At { x: number; z: number }

export interface Bank { from: At; to: At; toLand: At }

export interface WaterMap {
  tiles: At[];
  banks: Bank[];
  at(x: number, z: number): WaterPoint;
}

interface Cell { c: number; r: number; water: boolean }

const SIDES = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
const AROUND = [...SIDES, [-1, -1], [1, -1], [-1, 1], [1, 1]] as const;

// Worked out in the tile grid (col, row; row 0 the north edge), then turned to the world (x east, z north). Bridges
// are cells too, so a river cut by one is one river.
export function waterMap(level: LevelLayout): WaterMap {
  const { halfWidth, halfDepth } = mapHalfSize(level);
  const cols = halfWidth * 2, rows = halfDepth * 2;
  const kinds: (TileKind | null)[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) kinds.push(tileAt(level, c - halfWidth + 0.5, halfDepth - r - 0.5));
  }
  const onMap = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;
  const kindAt = (c: number, r: number) => (onMap(c, r) ? kinds[r * cols + c] ?? null : null);
  const wet = (c: number, r: number) => kindAt(c, r) === "water";

  const index = new Int32Array(cols * rows).fill(-1), cells: Cell[] = [];
  kinds.forEach((kind, k) => {
    if (kind !== "water" && kind !== "bridge") return;
    index[k] = cells.push({ c: k % cols, r: Math.floor(k / cols), water: kind === "water" }) - 1;
  });
  const indexAt = (c: number, r: number) => (onMap(c, r) ? index[r * cols + c]! : -1);
  const offMap = woodsRound(kinds, cols, rows);

  const shoreAt = (u: number, v: number) => {
    let best = SHORE_CAP_TILES;
    const reach = SHORE_CAP_TILES + 1, c0 = Math.floor(u), r0 = Math.floor(v);
    for (let r = r0 - reach; r <= r0 + reach; r++) {
      for (let c = c0 - reach; c <= c0 + reach; c++) {
        if (!wet(c, r)) best = Math.min(best, Math.hypot(Math.max(c - u, 0, u - c - 1), Math.max(r - v, 0, v - r - 1)));
      }
    }
    return best;
  };

  const near = (offsets: readonly (readonly [number, number])[]) =>
    cells.map(({ c, r }) => offsets.map(([dc, dr]) => indexAt(c + dc, r + dr)).filter((i) => i >= 0));
  const neighbours = near(SIDES), around = near(AROUND);
  const width = widths(cells, cols, rows, shoreAt);
  const flowU = new Float64Array(cells.length), flowV = new Float64Array(cells.length);
  for (const body of bodies(neighbours)) {
    const touching = body.filter((i) => {
      const { c, r, water } = cells[i]!;
      return water && SIDES.some(([dc, dr]) => offMap(c + dc, r + dr));
    });
    const ends = runsOff(cells, around, groups(touching, around));
    if (!ends) continue;
    const [source, mouth] = ends;
    const h = potential(body, neighbours, stepsFrom(around, source), stepsFrom(around, mouth), source, mouth);
    const flux = source.reduce((sum, s) => sum + neighbours[s]!.reduce((q, n) => q + h[n]!, 0), 0);
    for (const i of body) {
      const { c, r } = cells[i]!;
      const slope = (dc: number, dr: number) => {
        const ahead = indexAt(c + dc, r + dr), behind = indexAt(c - dc, r - dr);
        if (ahead >= 0 && behind >= 0) return (h[ahead]! - h[behind]!) / 2;
        if (ahead >= 0) return h[ahead]! - h[i]!;
        return behind >= 0 ? h[i]! - h[behind]! : 0;
      };
      const u = slope(1, 0), v = slope(0, 1), length = Math.hypot(u, v);
      if (length < 1e-12) continue;
      // As wide as the widest pool round it, or as much as the flux through it says: so nooks off the stream lie still.
      const speed = FLOW.tilesPerSec * Math.min(1, FLOW.fullSpeedWidthTiles / width[i]!,
        (FLOW.fullSpeedWidthTiles * length) / flux);
      flowU[i] = (u / length) * speed;
      flowV[i] = (v / length) * speed;
    }
  }

  const waterCells = cells.filter((cell) => cell.water), banks: Bank[] = [];
  for (const { c, r } of waterCells) {
    const x = c - halfWidth, z = halfDepth - r - 1;
    if (!wet(c, r - 1)) banks.push({ from: { x, z: z + 1 }, to: { x: x + 1, z: z + 1 }, toLand: { x: 0, z: 1 } });
    if (!wet(c, r + 1)) banks.push({ from: { x, z }, to: { x: x + 1, z }, toLand: { x: 0, z: -1 } });
    if (!wet(c - 1, r)) banks.push({ from: { x, z }, to: { x, z: z + 1 }, toLand: { x: -1, z: 0 } });
    if (!wet(c + 1, r)) banks.push({ from: { x: x + 1, z }, to: { x: x + 1, z: z + 1 }, toLand: { x: 1, z: 0 } });
  }

  return {
    tiles: waterCells.map(({ c, r }) => ({ x: c - halfWidth, z: halfDepth - r - 1 })),
    banks,
    at(x, z) {
      const u = x + halfWidth, v = halfDepth - z, shore = shoreAt(u, v);
      const c0 = Math.floor(u - 0.5), r0 = Math.floor(v - 0.5), fu = u - 0.5 - c0, fv = v - 0.5 - r0;
      let sumU = 0, sumV = 0, weight = 0;
      for (const [dc, dr, w] of [[0, 0, (1 - fu) * (1 - fv)], [1, 0, fu * (1 - fv)], [0, 1, (1 - fu) * fv],
        [1, 1, fu * fv]] as const) {
        const i = indexAt(c0 + dc, r0 + dr);
        if (i < 0 || w === 0) continue;
        sumU += flowU[i]! * w;
        sumV += flowV[i]! * w;
        weight += w;
      }
      const keep = weight > 0 ? (FLOW.atBankShare + (1 - FLOW.atBankShare) * Math.min(1, shore)) / weight : 0;
      const t = clamp(shore / SLOPE_TILES, 0, 1);
      return {
        flowX: sumU * keep, flowZ: -sumV * keep, shore,
        depth: WATER_DEPTH_TILES.bank + (WATER_DEPTH_TILES.deep - WATER_DEPTH_TILES.bank) * t * t * (3 - 2 * t),
      };
    },
  };
}

// Off the map, or in the woods, rocks or walls joined to its edge, which water runs under and away.
function woodsRound(kinds: (TileKind | null)[], cols: number, rows: number): (c: number, r: number) => boolean {
  const woods = new Uint8Array(cols * rows), queue: number[] = [];
  const reach = (c: number, r: number) => {
    const k = r * cols + c, kind = kinds[k] ?? null;
    if (woods[k] || kind === "water" || (kind !== null && !TILES[kind].solid)) return;
    woods[k] = 1;
    queue.push(k);
  };
  for (let c = 0; c < cols; c++) { reach(c, 0); reach(c, rows - 1); }
  for (let r = 0; r < rows; r++) { reach(0, r); reach(cols - 1, r); }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]! % cols, r = Math.floor(queue[q]! / cols);
    for (const [dc, dr] of SIDES) {
      if (c + dc >= 0 && r + dr >= 0 && c + dc < cols && r + dr < rows) reach(c + dc, r + dr);
    }
  }
  return (c, r) => c < 0 || r < 0 || c >= cols || r >= rows || woods[r * cols + c] === 1;
}

// Source and mouth: the two stretches on the edge farthest apart, north to south (else west to east), so rivers agree.
function runsOff(cells: Cell[], around: number[][], stretches: number[][]): [number[], number[]] | null {
  if (stretches.length < 2) return null;
  let pair: [number[], number[]] = [stretches[0]!, stretches[1]!], best = -1;
  stretches.forEach((a, k) => {
    const steps = stepsFrom(around, a);
    for (const b of stretches.slice(k + 1)) {
      const apart = Math.min(...b.map((i) => steps.get(i)!));
      if (apart > best) [best, pair] = [apart, [a, b]];
    }
  });
  const mean = (g: number[], of: (cell: Cell) => number) => g.reduce((sum, i) => sum + of(cells[i]!), 0) / g.length;
  const [a, b] = pair, south = mean(b, (cell) => cell.r) - mean(a, (cell) => cell.r);
  const downstream = Math.abs(south) > 1e-9 ? south > 0 : mean(b, (cell) => cell.c) > mean(a, (cell) => cell.c);
  return downstream ? [a, b] : [b, a];
}

function groups(members: number[], around: number[][]): number[][] {
  const left = new Set(members), found: number[][] = [];
  for (const start of members) {
    if (!left.delete(start)) continue;
    const group = [start];
    for (let k = 0; k < group.length; k++) {
      for (const n of around[group[k]!]!) if (left.delete(n)) group.push(n);
    }
    found.push(group);
  }
  return found;
}

function widths(cells: Cell[], cols: number, rows: number, shoreAt: (u: number, v: number) => number): number[] {
  const centres = new Float64Array(cols * rows).fill(-1), corners = new Float64Array((cols + 1) * (rows + 1)).fill(-1);
  const cached = (store: Float64Array, k: number, u: number, v: number) =>
    store[k]! >= 0 ? store[k]! : (store[k] = shoreAt(u, v));
  return cells.map(({ c, r }) => {
    let best = 0;
    for (let dr = -SHORE_CAP_TILES; dr <= SHORE_CAP_TILES; dr++) {
      for (let dc = -SHORE_CAP_TILES; dc <= SHORE_CAP_TILES; dc++) {
        const pc = c + dc, pr = r + dr;
        if (pc >= 0 && pr >= 0 && pc < cols && pr < rows) {
          const s = cached(centres, pr * cols + pc, pc + 0.5, pr + 0.5);
          if (s > best && Math.hypot(dc, dr) <= s) best = s;
        }
        if (pc >= 0 && pr >= 0 && pc <= cols && pr <= rows) {
          const s = cached(corners, pr * (cols + 1) + pc, pc, pr);
          if (s > best && Math.hypot(dc - 0.5, dr - 0.5) <= s) best = s;
        }
      }
    }
    return Math.max(best * 2, 1);
  });
}

function bodies(neighbours: number[][]): number[][] {
  const seen = new Uint8Array(neighbours.length), found: number[][] = [];
  for (let start = 0; start < neighbours.length; start++) {
    if (seen[start]) continue;
    const body = [start];
    seen[start] = 1;
    for (let k = 0; k < body.length; k++) {
      for (const n of neighbours[body[k]!]!) {
        if (!seen[n]) {
          seen[n] = 1;
          body.push(n);
        }
      }
    }
    found.push(body.sort((a, b) => a - b));
  }
  return found;
}

// 8-way, so every tile across a straight end of the water is the same number of steps from anywhere along it.
function stepsFrom(neighbours: number[][], from: number[]): Map<number, number> {
  const steps = new Map(from.map((i) => [i, 0])), queue = [...from];
  for (let k = 0; k < queue.length; k++) {
    for (const n of neighbours[queue[k]!]!) {
      if (!steps.has(n)) {
        steps.set(n, steps.get(queue[k]!)! + 1);
        queue.push(n);
      }
    }
  }
  return steps;
}

/** Potential flow: 0 at the source, 1 at the mouth, every other tile the mean of its neighbours (banks let none out). */
function potential(
  body: number[], neighbours: number[][], fromSource: Map<number, number>, fromMouth: Map<number, number>,
  source: number[], mouth: number[],
): number[] {
  const h: number[] = [], ends = new Set([...source, ...mouth]);
  for (const i of body) h[i] = fromSource.get(i)! / (fromSource.get(i)! + fromMouth.get(i)!);
  for (let sweep = 0; sweep < SOLVE.maxSweeps; sweep++) {
    let change = 0;
    for (const i of body) {
      if (ends.has(i)) continue;
      const near = neighbours[i]!, mean = near.reduce((sum, n) => sum + h[n]!, 0) / near.length;
      const step = SOLVE.overRelax * (mean - h[i]!);
      h[i] = h[i]! + step;
      change = Math.max(change, Math.abs(step));
    }
    if (change < SOLVE.doneBelow) break;
  }
  return h;
}
