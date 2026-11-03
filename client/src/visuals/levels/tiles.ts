import { mapHalfSize, seededRandom, tileAt, type LevelMap, type TileKind } from "@infinite-tower/shared";
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

/** `col` and `row` count from the map's north-west corner. */
function eachTile(level: LevelMap, visit: (t: Tile) => void): void {
  const { halfWidth, halfDepth } = mapHalfSize(level);
  for (let row = 0; row < halfDepth * 2; row++) {
    for (let col = 0; col < halfWidth * 2; col++) {
      const x = col - halfWidth, z = halfDepth - row - 1, kind = tileAt(level, x + 0.5, z + 0.5);
      if (kind) visit({ col, row, x, z, kind });
    }
  }
}

interface Tile { col: number; row: number; x: number; z: number; kind: TileKind }

const tileRandom = (t: Tile, salt: number) => seededRandom(salt + t.col * 7919 + t.row * 104729);

/** Onto a canvas of the map × PX_PER_TILE pixels, north at the top, a row of tiles a step. */
export function* paintGround(pen: Pen, level: LevelMap, looks: TileLooks): Generator<void, void> {
  const kinds = new Map<string, TileKind>(), tiles: Tile[] = [];
  eachTile(level, (t) => {
    kinds.set(`${t.col},${t.row}`, t.kind);
    tiles.push(t);
  });
  for (const [i, t] of tiles.entries()) {
    if (i > 0 && t.row !== tiles[i - 1]!.row) yield;
    const ground = looks[t.kind].ground;
    const same = (dx: number, dy: number) => {
      const next = kinds.get(`${t.col + dx},${t.row + dy}`);
      return next === undefined || looks[next].ground === ground;
    };
    ground(pen, t.col * PX_PER_TILE, t.row * PX_PER_TILE, tileRandom(t, 1), same);
  }
}

export function tileProps(level: LevelMap, looks: TileLooks): Prop[] {
  const props: Prop[] = [];
  eachTile(level, (t) => {
    const spec = looks[t.kind].props;
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
