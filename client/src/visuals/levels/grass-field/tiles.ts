import type { Pen } from "../../overworld3d/props.js";
import type { GroundPaint, TileLooks } from "../tiles.js";

const T = 16;
const GRASS = { base: "#4a6338", light: "#56703f", dark: "#3f5631", blade: "#61793f", tip: "#7f8f52" };
const TALL = { base: "#2f4a2b", dark: "#253c23", mid: "#40613a", light: "#58784a", tip: "#86935a" };
const DIRT = { base: "#6f5a43", dark: "#5c4a38", light: "#82694d", pebble: "#958673", edge: "#4c3d2f" };
const WATER = { base: "#2b4656", deep: "#233b4a", ripple: "#3a5a6a", shine: "#7f9ca6", bank: "#3a382c" };
const WOOD = { base: "#6a4b30", dark: "#4a3322", light: "#836042", rail: "#3a281b" };
const STONE = { base: "#6a6762", dark: "#4b4945", light: "#807c75", moss: "#53663c" };
const PETALS = ["#d9d2bd", "#d6b45a", "#c57f92", "#8ea0c9"];

function speckle(pen: Pen, x: number, y: number, rand: () => number, colours: string[], count: number): void {
  for (let i = 0; i < count; i++) {
    pen.rect(x + Math.floor(rand() * T), y + Math.floor(rand() * T), 1 + Math.floor(rand() * 2), 1,
      colours[Math.floor(rand() * colours.length)]!);
  }
}

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
    pen.rect(fx, fy, 1, 1, PETALS[Math.floor(rand() * PETALS.length)]!);
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

const water: GroundPaint = (pen, x, y, rand, same) => {
  pen.rect(x, y, T, T, WATER.base);
  speckle(pen, x, y, rand, [WATER.deep, WATER.deep], 10);
  for (let i = 0; i < 3; i++) {
    const rx = x + Math.floor(rand() * 12), ry = y + 1 + Math.floor(rand() * 14);
    pen.rect(rx, ry, 3 + Math.floor(rand() * 2), 1, rand() < 0.3 ? WATER.shine : WATER.ripple);
  }
  edges(pen, x, y, same, WATER.bank, (ex, ey, w, h) =>
    pen.rect(ex + (h > 1 ? 1 : 0), ey + (w > 1 ? 1 : 0), w, h, WATER.ripple));
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

export const GRASS_FIELD_TILES: TileLooks = {
  grass: { ground: grass, props: { kinds: ["tuft"], count: 0.3, scale: 0.6 } },
  flowers: { ground: flowers, props: { kinds: ["flowers"], count: 2, scale: 0.7 } },
  path: { ground: dirt },
  bridge: { ground: planks },
  ruinFloor: { ground: flagstones },
  tallGrass: { ground: tallGrass, props: { kinds: ["tallGrass"], count: 4, scale: 0.8 } },
  tree: { ground: grass, props: { kinds: ["tree", "tree", "pine"], count: 1, scale: 0.6 } },
  rock: { ground: grass, props: { kinds: ["rock"], count: 1, scale: 0.75 } },
  water: { ground: water },
  ruinWall: { ground: flagstones, props: { kinds: ["ruin"], count: 1, scale: 1 } },
};
