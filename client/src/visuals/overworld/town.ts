import { isSolid, seededRandom, tileAt, type Rect, type TileKind, type WorldMap } from "@infinite-tower/shared";
import type { Ledge } from "./scenery.js";

export type Side = "north" | "south" | "east" | "west";
export type WallKind = "timber" | "stone" | "ochre" | "brick";
export type RoofKind = "red" | "slate" | "brown" | "green";

export interface House {
  walls: WallKind;
  /** Null: a wall one tile thick (a yard's or a room's), with no roof. */
  roof: RoofKind | null;
  ridge: "x" | "z" | null;
  wallY: number;
  door: Side | null;
  chimney: boolean;
  sign: number | null;
  flowers: boolean;
  lantern: boolean;
  use: HallUse | null;
}

export type HallUse = "barracks" | "kitchen";

// Corners from the Castle Ward's middle.
export const CASTLE_HALLS: readonly { use: HallUse; x: number; z: number; w: number; h: number }[] = [
  { use: "barracks", x: -38, z: 17, w: 13, h: 7 },
  { use: "kitchen", x: 24, z: -6, w: 6, h: 5 },
];
const HALL_LOOK: Record<HallUse, { walls: WallKind; roof: RoofKind; wallY: number }> = {
  barracks: { walls: "stone", roof: "slate", wallY: 3.5 },
  kitchen: { walls: "brick", roof: "brown", wallY: 2.7 },
};

/** Frontage of one house along its block, and the most it runs back before the block is cut again. */
export const LOT_TILES = { min: 3, max: 5, deep: 6 };
export const SIGNS = 4;
const WALLS: WallKind[] = ["timber", "stone", "ochre", "brick"];
const ROOFS: RoofKind[] = ["red", "slate", "brown", "green"];
const WALL_Y = [2.3, 2.7, 3.1, 3.5];
const THIN_WALL_Y = 2.4;
const ROOF_RISE_PER_TILE = 0.42;
const MAX_ROOF_RISE = 2.4;
/** How far past a chunk a block of houses is looked for: a block wider than this is cut at it. */
const BLOCK_REACH_TILES = 16;

const key = (x: number, z: number) => `${x},${z}`;

/** Each house whose middle lies in the chunk, whole even where it reaches into the next. */
export function houseLedges(map: WorldMap, chunk: Rect): Ledge[] {
  const castle = map.regions.find((r) => r.id === "kingdom")?.area;
  const hallOf = (r: Rect) => castle && CASTLE_HALLS.find((h) =>
    h.x + castle.x + castle.w / 2 === r.x && h.z + castle.z + castle.h / 2 === r.z && h.w === r.w && h.h === r.h);
  return blocksTouching(map, chunk, "house").flatMap((block): { rect: Rect; use: HallUse | null }[] => {
    const hall = hallOf(boundsOf(block));
    return hall ? [{ rect: boundsOf(block), use: hall.use }] : lotsOf(block).map((rect) => ({ rect, use: null }));
  }).filter(({ rect }) => middleIn(rect, chunk)).map(({ rect, use }) => houseOn(map, rect, use));
}

const GATE = { maxTiles: 8, overWallY: 1.4 };

export function gateMouths(map: WorldMap, chunk: Rect, wallY: (x: number, z: number) => number): Ledge[] {
  const wall = (x: number, z: number) => tileAt(map, x + 0.5, z + 0.5) === "castleWall";
  const open = (x: number, z: number) => tileAt(map, x + 0.5, z + 0.5) !== null && !isSolid(map, x + 0.5, z + 0.5);
  const out = new Map<string, Ledge>();
  const add = (rect: Rect, flankY: number) => {
    if (middleIn(rect, chunk)) out.set(`${rect.x},${rect.z},${rect.w},${rect.h}`, { rect, topY: flankY + GATE.overWallY, look: "gate" });
  };
  const reach = GATE.maxTiles + 1;
  for (const alongX of [true, false]) {
    const [a0, a1, b0, b1] = alongX
      ? [chunk.x - reach, chunk.x + chunk.w + reach, chunk.z - 1, chunk.z + chunk.h + 1]
      : [chunk.z - reach, chunk.z + chunk.h + reach, chunk.x - 1, chunk.x + chunk.w + 1];
    const at = (a: number, b: number): [number, number] => (alongX ? [a, b] : [b, a]);
    const passage = (b: number, from: number, to: number) =>
      wall(...at(from - 1, b)) && wall(...at(to, b)) && Array.from({ length: to - from }, (_, i) => from + i).every((a) => open(...at(a, b)));
    for (let b = b0; b <= b1; b++) {
      for (let a = a0; a < a1; a++) {
        if (!wall(...at(a, b)) || !open(...at(a + 1, b))) continue;
        let end = a + 1;
        while (end < a1 && open(...at(end, b))) end++;
        const from = a + 1, width = end - from;
        if (width > GATE.maxTiles || !passage(b, from, end)) continue;
        for (const side of [-1, 1]) {
          if (passage(b + side, from, end)) continue;
          if (!passage(b - side, from, end) || !open(...at(from - 1, b + side)) || !open(...at(end, b + side))) continue;
          const [x, z] = at(from, b);
          add(alongX ? { x, z, w: width, h: 1 } : { x, z, w: 1, h: width }, wallY(...at(from - 1, b)));
        }
        a = end - 1;
      }
    }
  }
  return [...out.values()];
}

export function wholeRuns(map: WorldMap, chunk: Rect, kind: TileKind): Rect[] {
  return blocksTouching(map, chunk, kind).map(boundsOf).filter((r) => middleIn(r, chunk));
}

const middleIn = (r: Rect, chunk: Rect) => {
  const x = r.x + r.w / 2, z = r.z + r.h / 2;
  return x >= chunk.x && x < chunk.x + chunk.w && z >= chunk.z && z < chunk.z + chunk.h;
};

function blocksTouching(map: WorldMap, chunk: Rect, kind: TileKind): Set<string>[] {
  const done = new Set<string>(), blocks: Set<string>[] = [];
  for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
    for (let z = chunk.z; z < chunk.z + chunk.h; z++) {
      if (done.has(key(x, z)) || tileAt(map, x + 0.5, z + 0.5) !== kind) continue;
      const block = blockOf(map, x, z, chunk, kind);
      for (const t of block) done.add(t);
      blocks.push(block);
    }
  }
  return blocks;
}

function blockOf(map: WorldMap, x: number, z: number, chunk: Rect, kind: TileKind): Set<string> {
  const reach = {
    x: chunk.x - BLOCK_REACH_TILES, z: chunk.z - BLOCK_REACH_TILES,
    w: chunk.w + 2 * BLOCK_REACH_TILES, h: chunk.h + 2 * BLOCK_REACH_TILES,
  };
  const block = new Set([key(x, z)]), todo = [[x, z]];
  while (todo.length > 0) {
    const [tx, tz] = todo.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = tx! + dx, nz = tz! + dz;
      if (block.has(key(nx, nz)) || tileAt(map, nx + 0.5, nz + 0.5) !== kind) continue;
      if (nx < reach.x || nx >= reach.x + reach.w || nz < reach.z || nz >= reach.z + reach.h) continue;
      block.add(key(nx, nz));
      todo.push([nx, nz]);
    }
  }
  return block;
}

function boundsOf(block: Set<string>): Rect {
  const at = [...block].map((k) => k.split(",").map(Number) as [number, number]);
  const x0 = Math.min(...at.map(([x]) => x)), z0 = Math.min(...at.map(([, z]) => z));
  return { x: x0, z: z0, w: Math.max(...at.map(([x]) => x)) - x0 + 1, h: Math.max(...at.map(([, z]) => z)) - z0 + 1 };
}

function lotsOf(block: Set<string>): Rect[] {
  return tileBlocks(boundsOf(block), (x, z) => block.has(key(Math.floor(x), Math.floor(z)))).flatMap(cut);
}

function cut(rect: Rect): Rect[] {
  if (Math.min(rect.w, rect.h) === 1) return [rect];
  const alongX = rect.w >= rect.h, long = alongX ? rect.w : rect.h, short = alongX ? rect.h : rect.w;
  const rand = seededRandom(rect.x * 7919 + rect.z * 104729 + 11);
  const fronts: number[] = [];
  for (let left = long; left > 0;) {
    const most = Math.min(LOT_TILES.max, left - LOT_TILES.min);
    const take = left <= LOT_TILES.max ? left : LOT_TILES.min + Math.floor(rand() * (most - LOT_TILES.min + 1));
    fronts.push(take);
    left -= take;
  }
  const rows = Math.ceil(short / LOT_TILES.deep), backs = Array.from({ length: rows }, (_, i) =>
    Math.floor((short * (i + 1)) / rows) - Math.floor((short * i) / rows));
  const lots: Rect[] = [];
  let a = 0;
  for (const front of fronts) {
    let b = 0;
    for (const back of backs) {
      lots.push(alongX
        ? { x: rect.x + a, z: rect.z + b, w: front, h: back }
        : { x: rect.x + b, z: rect.z + a, w: back, h: front });
      b += back;
    }
    a += front;
  }
  return lots;
}

function houseOn(map: WorldMap, rect: Rect, use: HallUse | null): Ledge {
  const rand = seededRandom(rect.x * 7919 + rect.z * 104729 + 23), pick = <T>(of: readonly T[]) => of[Math.floor(rand() * of.length)]!;
  const look = use ? HALL_LOOK[use] : { walls: pick(WALLS), roof: pick(ROOFS), wallY: pick(WALL_Y) };
  const { walls, roof, wallY } = look;
  const open = (side: Side) => sideOut(rect, side).filter(([x, z]) => !isSolid(map, x + 0.5, z + 0.5)).length;
  const sides: Side[] = ["south", "north", "east", "west"];
  const best = sides.reduce((a, b) => (open(b) > open(a) ? b : a));
  const door = open(best) > 0 ? best : null;
  if (Math.min(rect.w, rect.h) === 1) {
    return {
      rect, topY: THIN_WALL_Y, look: "house",
      house: {
        walls, roof: null, ridge: null, wallY: THIN_WALL_Y, door: null, chimney: false, sign: null, flowers: false,
        lantern: false, use: null,
      },
    };
  }
  const ridge = rect.w === rect.h ? (rand() < 0.5 ? "x" : "z") : rect.w > rect.h ? "x" : "z";
  const span = ridge === "x" ? rect.h : rect.w, rise = Math.min(MAX_ROOF_RISE, span * ROOF_RISE_PER_TILE);
  return {
    rect, topY: wallY + rise, look: "house",
    house: {
      walls, roof, ridge, wallY, door, chimney: use === "kitchen" || (!use && rand() < 0.55),
      sign: door && !use && rand() < 0.3 ? Math.floor(rand() * SIGNS) : null, flowers: !use && rand() < 0.6,
      lantern: use !== null || rand() < 0.5, use,
    },
  };
}

export function sideOut(rect: Rect, side: Side): [number, number][] {
  const along = side === "north" || side === "south" ? rect.w : rect.h;
  return Array.from({ length: along }, (_, i): [number, number] => {
    if (side === "north") return [rect.x + i, rect.z + rect.h];
    if (side === "south") return [rect.x + i, rect.z - 1];
    if (side === "east") return [rect.x + rect.w, rect.z + i];
    return [rect.x - 1, rect.z + i];
  });
}

const INDOOR = new Set(["marble", "carpet", "pad", "ruinFloor"]);

export function crenelsOf(map: WorldMap, rect: Rect): { x: number; z: number; side: Side }[] {
  const out: { x: number; z: number; side: Side }[] = [];
  for (const side of ["north", "south", "east", "west"] as const) {
    sideOut(rect, side).forEach(([x, z], i) => {
      const kind = tileAt(map, x + 0.5, z + 0.5);
      if (kind === null || isSolid(map, x + 0.5, z + 0.5) || INDOOR.has(kind)) return;
      const along = side === "north" || side === "south";
      out.push({
        x: along ? rect.x + i : side === "east" ? rect.x + rect.w - 1 : rect.x,
        z: along ? (side === "north" ? rect.z + rect.h - 1 : rect.z) : rect.z + i,
        side,
      });
    });
  }
  return out;
}

export function tileBlocks(area: Rect, is: (x: number, z: number) => boolean): Rect[] {
  const cols = area.w, rows = area.h, north = area.z + area.h;
  const at = (c: number, r: number) => is(area.x + c + 0.5, north - r - 0.5);
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
      rects.push({ x: area.x + c, z: north - r - h, w, h });
    }
  }
  return rects;
}
