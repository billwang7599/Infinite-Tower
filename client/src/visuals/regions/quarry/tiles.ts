import { groundPainters } from "../ground.js";
import { TOWN_TILES } from "../kingdom/tiles.js";
import type { GroundPaint, TileLooks } from "../tiles.js";

const PAINT = groundPainters({
  grass: { base: "#a89e88", light: "#b8ae97", dark: "#968c77", blade: "#8a8a5e", tip: "#a6a070" },
  tall: { base: "#8a7f63", dark: "#6c634d", mid: "#a09370", light: "#bcad86", tip: "#d4c596" },
  dirt: { base: "#978c76", dark: "#837965", light: "#a99e87", pebble: "#c4baa4", edge: "#7a705d" },
  bed: { base: "#7d7a6a", dark: "#666355", pebble: "#9a9684", stone: "#b3ad98", weed: "#5d6a48", foot: "#4a473d" },
  wood: { base: "#6a4b30", dark: "#4a3322", light: "#836042", rail: "#3a281b" },
  stone: { base: "#a9a08c", dark: "#7f7765", light: "#c2b9a4", moss: "#8a8466" },
  pad: { base: "#b9b19e", dark: "#867e6c", light: "#d2cab6", rune: "#9fe0d2" },
  petals: ["#d9d0bb"],
});

const T = 16;
const DUST = {
  base: "#aea48d", light: "#c3baa3", dark: "#978d78", chip: "#d6cdb8", crack: "#857b67", gravel: "#8e8471",
  slab: "#bfb59e", slabHi: "#d3cab4", slabLo: "#91876f",
};
const RAIL = { ballast: "#938974", sleeper: "#5a4632", sleeperHi: "#6f583f", iron: "#5f6268", shine: "#9a9ea4" };

const dust: GroundPaint = (pen, x, y, rand) => {
  pen.rect(x, y, T, T, DUST.base);
  const patch = rand();
  if (patch < 0.14) {
    const w = 7 + Math.floor(rand() * 7), h = 5 + Math.floor(rand() * 6);
    const sx = x + Math.floor(rand() * (T - w)), sy = y + Math.floor(rand() * (T - h));
    pen.rect(sx, sy, w, h, DUST.slab);
    pen.rect(sx, sy, w, 1, DUST.slabHi);
    pen.rect(sx, sy + h - 1, w, 1, DUST.slabLo);
    pen.rect(sx + w - 1, sy, 1, h, DUST.slabLo);
  } else if (patch < 0.3) {
    for (let i = 0; i < 30; i++) pen.rect(x + 2 + Math.floor(rand() * 12), y + 2 + Math.floor(rand() * 12), 1, 1, DUST.gravel);
  }
  for (let i = 0; i < 26; i++) {
    pen.rect(x + Math.floor(rand() * T), y + Math.floor(rand() * T), 1 + Math.floor(rand() * 2), 1,
      [DUST.light, DUST.dark, DUST.dark, DUST.light][i % 4]!);
  }
  for (let i = 0; i < 2; i++) pen.rect(x + 1 + Math.floor(rand() * 13), y + 1 + Math.floor(rand() * 13), 2, 1, DUST.chip);
  if (rand() < 0.25) {
    let cx = x + Math.floor(rand() * 12), cy = y + Math.floor(rand() * 12);
    for (let i = 0; i < 5; i++) { pen.rect(cx, cy, 1, 1, DUST.crack); cx += 1; cy += rand() < 0.5 ? 1 : 0; }
  }
};

const rails: GroundPaint = (pen, x, y, rand, same) => {
  dust(pen, x, y, rand, same);
  const across = same(-1, 0) || same(1, 0), along = same(0, -1) || same(0, 1) || !across;
  if (along) {
    pen.rect(x + 3, y, 10, T, RAIL.ballast);
    for (let k = 1; k < T; k += 4) { pen.rect(x + 2, y + k, 12, 2, RAIL.sleeper); pen.rect(x + 2, y + k, 12, 1, RAIL.sleeperHi); }
    for (const rx of [4, 11]) pen.rect(x + rx, y, 1, T, RAIL.iron);
    for (const rx of [4, 11]) pen.rect(x + rx, y + Math.floor(rand() * 12), 1, 3, RAIL.shine);
  }
  if (across) {
    pen.rect(x, y + 3, T, 10, RAIL.ballast);
    for (let k = 1; k < T; k += 4) { pen.rect(x + k, y + 2, 2, 12, RAIL.sleeper); pen.rect(x + k, y + 2, 1, 12, RAIL.sleeperHi); }
    for (const ry of [4, 11]) pen.rect(x, y + ry, T, 1, RAIL.iron);
    for (const ry of [4, 11]) pen.rect(x + Math.floor(rand() * 12), y + ry, 3, 1, RAIL.shine);
  }
};

export const QUARRY_WORKINGS = {
  cutStone: { ground: PAINT.flagstones },
  cart: { ground: rails, props: { kinds: ["cart"], count: 1, scale: 0.9 } },
  crane: { ground: dust, props: { kinds: ["crane"], count: 1, scale: 1 } },
} satisfies Partial<TileLooks>;

export const QUARRY_TILES: TileLooks = {
  grass: { ground: dust, props: { kinds: ["chips"], count: 0.12, scale: 0.7 } },
  flowers: { ground: dust, props: { kinds: ["chips", "rubble"], count: 1, scale: 0.7 } },
  path: { ground: rails },
  bridge: { ground: PAINT.planks },
  ruinFloor: { ground: PAINT.flagstones },
  tallGrass: { ground: PAINT.tallGrass, props: { kinds: ["scrub"], count: 3, scale: 0.85 } },
  tree: { ground: dust, props: { kinds: ["deadTree"], count: 1, scale: 0.6 } },
  rock: { ground: dust, props: { kinds: ["rubble"], count: 1, scale: 0.85 } },
  water: { ground: PAINT.riverbed },
  ruinWall: { ground: PAINT.flagstones, props: { kinds: ["shack"], count: 1, scale: 1 } },
  pad: { ground: PAINT.pad },
  ...QUARRY_WORKINGS,
  ...TOWN_TILES,
};
