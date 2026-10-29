import { mapHalfSize, seededRandom, tileAt, type LevelLayout, type TileKind } from "@infinite-tower/shared";
import { PX_PER_TILE, type Pen } from "../overworld3d/props.js";
import type { Prop, PropKind } from "../overworld3d/scenery.js";

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

/** `col` and `row` count from the map's north-west corner; the margin round it is `outside`. */
function eachTile(level: LevelLayout, outside: TileKind, margin: number, visit: (t: Tile) => void): void {
  const { halfWidth, halfDepth } = mapHalfSize(level);
  for (let row = -margin; row < halfDepth * 2 + margin; row++) {
    for (let col = -margin; col < halfWidth * 2 + margin; col++) {
      const x = col - halfWidth, z = halfDepth - row - 1;
      visit({ col, row, x, z, kind: tileAt(level, x + 0.5, z + 0.5) ?? outside });
    }
  }
}

interface Tile { col: number; row: number; x: number; z: number; kind: TileKind }

const tileRandom = (t: Tile, salt: number) => seededRandom(salt + t.col * 7919 + t.row * 104729);

/** Onto a canvas of (map + 2 × margin) × PX_PER_TILE pixels, north at the top. */
export function paintGround(pen: Pen, level: LevelLayout, looks: TileLooks, outside: TileKind, margin: number): void {
  const kinds = new Map<string, TileKind>();
  eachTile(level, outside, margin, (t) => kinds.set(`${t.col},${t.row}`, t.kind));
  eachTile(level, outside, margin, (t) => {
    const ground = looks[t.kind].ground;
    const same = (dx: number, dy: number) => {
      const next = kinds.get(`${t.col + dx},${t.row + dy}`);
      return next === undefined || looks[next].ground === ground;
    };
    ground(pen, (t.col + margin) * PX_PER_TILE, (t.row + margin) * PX_PER_TILE, tileRandom(t, 1), same);
  });
}

/** The same tile always gets the same props, whatever the margin. */
export function tileProps(level: LevelLayout, looks: TileLooks, outside: TileKind, margin: number): Prop[] {
  const props: Prop[] = [];
  eachTile(level, outside, margin, (t) => {
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
