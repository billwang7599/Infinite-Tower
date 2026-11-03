import { CHUNK_TILES, regionAt, type Rect, type Vec2, type WorldMap } from "@infinite-tower/shared";
import type { Region, RegionDef, SpawnDef } from "./region.js";

/** Further than the camera sees, so the world never shows an edge. */
export const WORLD_MARGIN_TILES = 16;
export const VOID_TILE = " ";
const PLAYER_SPEED = 5;
const SAFE_TIME = 2;

export interface Patch { rect: Rect; char: string }

export interface WorldDef {
  /** Only this is sent to the client. */
  layout: WorldMap;
  regions: Region[];
  spawns: SpawnDef[];
  /** No encounters for this long after a fight. */
  safeTime: number;
}

export const toWorld = (origin: Vec2, at: Vec2): Vec2 => ({ x: at.x + origin.x, z: at.z + origin.z });

export function areaOf(def: Pick<RegionDef, "id" | "origin" | "tiles">): Rect {
  const w = def.tiles[0]?.length ?? 0, h = def.tiles.length, x = def.origin.x - w / 2, z = def.origin.z - h / 2;
  if (!Number.isInteger(x) || !Number.isInteger(z)) throw new Error(`${def.id} doesn't sit on whole tiles`);
  return { x, z, w, h };
}

const rectDist = (r: Rect, x: number, z: number) =>
  Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.z - z, 0, z - r.z - r.h));

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.h && b.z < a.z + a.h;

export function composeWorld(defs: readonly RegionDef[], patches: readonly Patch[] = []): WorldDef {
  const areas = defs.map(areaOf);
  areas.forEach((a, i) => areas.slice(i + 1).forEach((b, k) => {
    if (overlap(a, b)) throw new Error(`${defs[i]!.id} overlaps ${defs[i + 1 + k]!.id}`);
  }));
  const snap = (v: number, up: boolean) => (up ? Math.ceil(v / CHUNK_TILES) : Math.floor(v / CHUNK_TILES)) * CHUNK_TILES;
  const west = snap(Math.min(...areas.map((a) => a.x)) - WORLD_MARGIN_TILES, false);
  const south = snap(Math.min(...areas.map((a) => a.z)) - WORLD_MARGIN_TILES, false);
  const east = snap(Math.max(...areas.map((a) => a.x + a.w)) + WORLD_MARGIN_TILES, true);
  const north = snap(Math.max(...areas.map((a) => a.z + a.h)) + WORLD_MARGIN_TILES, true);
  const bounds = { x: west, z: south, w: east - west, h: north - south };
  const labels = defs.map((d, i) => ({ id: d.id, name: d.name, theme: d.theme, area: areas[i]! }));
  const fillOf = new Map(defs.map((d) => [d.id, d.fill]));

  const rows: string[][] = [];
  for (let row = 0; row < bounds.h; row++) {
    const chars: string[] = [];
    const z = north - row - 0.5;
    for (let col = 0; col < bounds.w; col++) {
      const x = west + col + 0.5, i = areas.findIndex((a) => x > a.x && x < a.x + a.w && z > a.z && z < a.z + a.h);
      if (i >= 0) {
        const a = areas[i]!;
        chars.push(defs[i]!.tiles[Math.floor(a.z + a.h - z)]![Math.floor(x - a.x)]!);
      } else {
        const near = regionAt({ regions: labels }, x, z);
        chars.push(rectDist(near.area, x, z) > WORLD_MARGIN_TILES ? VOID_TILE : fillOf.get(near.id)!);
      }
    }
    rows.push(chars);
  }
  for (const { rect, char } of patches) {
    for (let z = rect.z; z < rect.z + rect.h; z++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) rows[north - z - 1]![x - west] = char;
    }
  }

  const layout: WorldMap = {
    bounds, tiles: rows.map((r) => r.join("")), regions: labels, playerSpeed: PLAYER_SPEED,
    campfires: defs.flatMap((d) => d.campfires.map((c) => toWorld(d.origin, c))),
  };
  const regions: Region[] = defs.map((d, i) => {
    const spawn = toWorld(d.origin, d.spawn);
    return {
      ...labels[i]!, spawn, campfires: d.campfires.map((c) => toWorld(d.origin, c)), arenaId: d.arenaId, duelArenaId: d.duelArenaId, grass: d.grass,
      spawns: d.spawns.map((s) => ({
        ...s, at: toWorld(d.origin, s.at), away: toWorld(d.origin, { x: -s.at.x, z: s.at.z }),
      })),
      hasPad: layout.tiles[north - Math.floor(spawn.z) - 1]?.[Math.floor(spawn.x) - west] === "@",
    };
  });
  return { layout, regions, spawns: regions.flatMap((r) => r.spawns), safeTime: SAFE_TIME };
}

export function regionOf(world: WorldDef, at: Vec2): Region {
  const label = regionAt(world.layout, at.x, at.z);
  return world.regions.find((r) => r.id === label.id)!;
}
