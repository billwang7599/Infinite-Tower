import { seededRandom, tileAt, type Rect, type TileKind, type WorldMap } from "@infinite-tower/shared";
import { PX_PER_TILE } from "../../gfx/grid.js";
import type { Pen } from "../overworld/props.js";
import type { Prop, PropKind } from "../overworld/scenery.js";

/** `same(dx, dy)`: the neighbour that way (+dy is south) looks the same. */
export type GroundPaint = (
  pen: Pen, x: number, y: number, rand: () => number, same: (dx: number, dy: number) => boolean,
) => void;

export interface TileLook {
  ground: GroundPaint;
  /** `count` a tile (under 1: the chance of one), each `scale` give or take 15%. */
  props?: { kinds: PropKind[]; count: number; scale: number };
}

export type TileLooks = Record<TileKind, TileLook>;

interface Tile { x: number; z: number; kind: TileKind }

function eachTile(map: WorldMap, chunk: Rect, visit: (t: Tile) => void): void {
  for (let z = chunk.z + chunk.h - 1; z >= chunk.z; z--) {
    for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
      const kind = tileAt(map, x + 0.5, z + 0.5);
      if (kind) visit({ x, z, kind });
    }
  }
}

const tileRandom = (t: { x: number; z: number }, salt: number) => seededRandom(salt + t.x * 7919 + t.z * 104729);

export type LooksAt = (x: number, z: number) => TileLooks;

export function* paintGround(pen: Pen, map: WorldMap, chunk: Rect, looksAt: LooksAt): Generator<void, void> {
  const north = chunk.z + chunk.h;
  let row = -1;
  for (const t of tilesOf(map, chunk)) {
    if (row >= 0 && t.z !== row) yield;
    row = t.z;
    const ground = looksAt(t.x, t.z)[t.kind].ground;
    const same = (dx: number, dy: number) => {
      const x = t.x + dx, z = t.z - dy, next = tileAt(map, x + 0.5, z + 0.5);
      return next === null || looksAt(x, z)[next].ground === ground;
    };
    ground(pen, (t.x - chunk.x) * PX_PER_TILE, (north - 1 - t.z) * PX_PER_TILE, tileRandom(t, 1), same);
  }
}

function tilesOf(map: WorldMap, chunk: Rect): Tile[] {
  const tiles: Tile[] = [];
  eachTile(map, chunk, (t) => tiles.push(t));
  return tiles;
}

export function tileProps(map: WorldMap, chunk: Rect, looksAt: LooksAt): Prop[] {
  const props: Prop[] = [];
  eachTile(map, chunk, (t) => {
    const spec = looksAt(t.x, t.z)[t.kind].props;
    if (!spec) return;
    const rand = tileRandom(t, 2);
    const count = spec.count >= 1 ? spec.count : rand() < spec.count ? 1 : 0;
    const across = Math.ceil(Math.sqrt(count)), spread = count > 1 ? 0.7 : 0.2;
    for (let i = 0; i < count; i++) {
      props.push({
        kind: spec.kinds[Math.floor(rand() * spec.kinds.length)]!,
        x: t.x + (i % across + (1 - spread) / 2 + rand() * spread) / across,
        y: 0,
        z: t.z + (Math.floor(i / across) + (1 - spread) / 2 + rand() * spread) / across,
        scale: spec.scale * (0.85 + rand() * 0.3),
      });
    }
  });
  return props;
}
