import type { Pen } from "../overworld/props.js";
import type { GroundPaint } from "./tiles.js";

export interface GroundPalette {
  grass: { base: string; light: string; dark: string; blade: string; tip: string };
  tall: { base: string; dark: string; mid: string; light: string; tip: string };
  dirt: { base: string; dark: string; light: string; pebble: string; edge: string };
  bed: { base: string; dark: string; pebble: string; stone: string; weed: string; foot: string };
  wood: { base: string; dark: string; light: string; rail: string };
  stone: { base: string; dark: string; light: string; moss: string };
  petals: string[];
}

const T = 16;

function speckle(pen: Pen, x: number, y: number, rand: () => number, colours: string[], count: number): void {
  for (let i = 0; i < count; i++) {
    pen.rect(x + Math.floor(rand() * T), y + Math.floor(rand() * T), 1 + Math.floor(rand() * 2), 1,
      colours[Math.floor(rand() * colours.length)]!);
  }
}

function edges(
  pen: Pen, x: number, y: number, same: (dx: number, dy: number) => boolean, line: string,
  extra: (x: number, y: number, w: number, h: number) => void,
): void {
  const sides = [
    [0, -1, x, y, T, 1], [0, 1, x, y + T - 1, T, 1], [-1, 0, x, y, 1, T], [1, 0, x + T - 1, y, 1, T],
  ] as const;
  for (const [dx, dy, ex, ey, w, h] of sides) {
    if (same(dx, dy)) continue;
    pen.rect(ex, ey, w, h, line);
    extra(ex, ey, w, h);
  }
}

export function groundPainters(p: GroundPalette) {
  const { grass: GRASS, tall: TALL, dirt: DIRT, bed: BED, wood: WOOD, stone: STONE } = p;

  const grass: GroundPaint = (pen, x, y, rand) => {
    pen.rect(x, y, T, T, GRASS.base);
    speckle(pen, x, y, rand, [GRASS.light, GRASS.dark, GRASS.dark], 22);
    for (let i = 0; i < 4; i++) {
      const bx = x + Math.floor(rand() * 15), by = y + 2 + Math.floor(rand() * 13);
      pen.rect(bx, by - 2, 1, 2, GRASS.blade);
      if (rand() < 0.4) pen.rect(bx, by - 2, 1, 1, GRASS.tip);
    }
  };

  const flowers: GroundPaint = (pen, x, y, rand, same) => {
    grass(pen, x, y, rand, same);
    for (let i = 0; i < 3; i++) {
      const fx = x + 2 + Math.floor(rand() * 12), fy = y + 2 + Math.floor(rand() * 12);
      pen.rect(fx, fy, 1, 1, p.petals[Math.floor(rand() * p.petals.length)]!);
    }
  };

  const tallGrass: GroundPaint = (pen, x, y, rand, same) => {
    pen.rect(x, y, T, T, TALL.base);
    for (let i = 0; i < 18; i++) {
      const bx = x + Math.floor(rand() * T), by = y + 3 + Math.floor(rand() * 13), h = 3 + Math.floor(rand() * 4);
      pen.rect(bx, by - h, 1, h, [TALL.dark, TALL.mid, TALL.light][i % 3]!);
      if (rand() < 0.3) pen.rect(bx, by - h, 1, 1, TALL.tip);
    }
    if (!same(0, 1)) pen.rect(x, y + T - 1, T, 1, TALL.dark);
  };

  const dirt: GroundPaint = (pen, x, y, rand, same) => {
    pen.rect(x, y, T, T, DIRT.base);
    speckle(pen, x, y, rand, [DIRT.dark, DIRT.light, DIRT.light], 18);
    for (let i = 0; i < 2; i++) pen.rect(x + 1 + rand() * 13, y + 1 + rand() * 13, 2, 1, DIRT.pebble);
    edges(pen, x, y, same, DIRT.edge, (ex, ey, w, h) => {
      for (let k = 0; k < Math.max(w, h); k += 3) {
        if (rand() < 0.6) pen.rect(ex + (w > 1 ? k : 0), ey + (h > 1 ? k : 0), w > 1 ? 2 : 1, h > 1 ? 2 : 1, GRASS.base);
      }
    });
  };

  const riverbed: GroundPaint = (pen, x, y, rand, same) => {
    pen.rect(x, y, T, T, BED.base);
    speckle(pen, x, y, rand, [BED.dark, BED.dark, BED.pebble], 18);
    for (let i = 0; i < 4; i++) {
      const px = x + 1 + Math.floor(rand() * 13), py = y + 1 + Math.floor(rand() * 13);
      pen.rect(px, py, 2, 2, rand() < 0.5 ? BED.pebble : BED.stone);
      pen.rect(px, py + 1, 2, 1, BED.dark);
    }
    if (rand() < 0.35) {
      const wx = x + Math.floor(rand() * 10), wy = y + Math.floor(rand() * 10);
      for (let i = 0; i < 6; i++) pen.rect(wx + Math.floor(rand() * 6), wy + Math.floor(rand() * 6), 1, 2, BED.weed);
    }
    edges(pen, x, y, same, BED.foot, (ex, ey, w, h) =>
      pen.rect(ex + (h > 1 ? (ex === x ? 1 : -1) : 0), ey + (w > 1 ? (ey === y ? 1 : -1) : 0), w, h, BED.dark));
  };

  const planks: GroundPaint = (pen, x, y, rand, same) => {
    pen.rect(x, y, T, T, WOOD.base);
    for (let px = 0; px < T; px += 4) {
      pen.rect(x + px, y, 1, T, WOOD.dark);
      pen.rect(x + px + 1, y, 1, T, rand() < 0.5 ? WOOD.light : WOOD.base);
    }
    if (!same(0, -1)) pen.rect(x, y, T, 2, WOOD.rail);
    if (!same(0, 1)) pen.rect(x, y + T - 2, T, 2, WOOD.rail);
  };

  const flagstones: GroundPaint = (pen, x, y, rand) => {
    pen.rect(x, y, T, T, STONE.dark);
    for (const [sx, sy, w, h] of [[0, 0, 9, 7], [9, 0, 7, 7], [0, 7, 6, 9], [6, 7, 10, 9]] as const) {
      pen.rect(x + sx + 1, y + sy + 1, w - 1, h - 1, rand() < 0.3 ? STONE.light : STONE.base);
    }
    speckle(pen, x, y, rand, [STONE.moss, STONE.dark], 6);
  };

  return { grass, flowers, tallGrass, dirt, riverbed, planks, flagstones };
}
