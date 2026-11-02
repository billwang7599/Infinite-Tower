import { groundPainters } from "../ground.js";
import type { GroundPaint, TileLooks } from "../tiles.js";

const PAINT = groundPainters({
  grass: { base: "#4c6439", light: "#58713f", dark: "#40572f", blade: "#647b40", tip: "#839352" },
  tall: { base: "#2f4a2b", dark: "#253c23", mid: "#40613a", light: "#58784a", tip: "#86935a" },
  dirt: { base: "#6f5a43", dark: "#5c4a38", light: "#82694d", pebble: "#958673", edge: "#4c3d2f" },
  bed: { base: "#4c5a5e", dark: "#3c484c", pebble: "#6a777a", stone: "#8a9496", weed: "#46562f", foot: "#2e3538" },
  wood: { base: "#6a4b30", dark: "#4a3322", light: "#836042", rail: "#3a281b" },
  stone: { base: "#6f6c68", dark: "#4e4c49", light: "#86827b", moss: "#5b6a46" },
  pad: { base: "#b4ab98", dark: "#7a7262", light: "#cfc6b1", rune: "#f2d27a" },
  petals: ["#e8dcc0", "#d6b45a", "#c0392b", "#9ab8f2"],
});

const T = 16;

const marble: GroundPaint = (pen, x, y, rand) => {
  pen.rect(x, y, T, T, "#a39c8f");
  for (const [sx, sy] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) {
    pen.rect(x + sx, y + sy, 7, 7, (sx + sy) % 16 ? "#b8b0a2" : "#c7c0b2");
  }
  for (let i = 0; i < 3; i++) {
    const vx = x + Math.floor(rand() * 13), vy = y + Math.floor(rand() * 13);
    pen.rect(vx, vy, 3, 1, "#9a9284");
    pen.rect(vx + 2, vy + 1, 2, 1, "#9a9284");
  }
};

const carpet: GroundPaint = (pen, x, y, rand, same) => {
  pen.rect(x, y, T, T, "#7a1f24");
  for (let i = 0; i < 10; i++) pen.rect(x + Math.floor(rand() * T), y + Math.floor(rand() * T), 1, 1, "#8c2a2c");
  if (!same(-1, 0)) { pen.rect(x, y, 2, T, "#d2a64a"); pen.rect(x + 3, y, 1, T, "#d2a64a"); }
  if (!same(1, 0)) { pen.rect(x + T - 2, y, 2, T, "#d2a64a"); pen.rect(x + T - 4, y, 1, T, "#d2a64a"); }
};

const cobbles: GroundPaint = (pen, x, y, rand) => {
  pen.rect(x, y, T, T, "#4a4744");
  for (let row = 0; row < 4; row++) {
    const shift = row % 2 ? 2 : 0;
    for (let col = -1; col < 4; col++) {
      const sx = x + col * 4 + shift, sy = y + row * 4;
      const left = Math.max(sx, x), right = Math.min(sx + 3, x + T);
      if (right <= left) continue;
      pen.rect(left, sy, right - left, 3, ["#6b6762", "#625e5a", "#77726c"][Math.floor(rand() * 3)]!);
      pen.rect(left, sy, right - left, 1, "#837e77");
    }
  }
};

export const KINGDOM_TILES: TileLooks = {
  grass: { ground: PAINT.grass, props: { kinds: ["tuft"], count: 0.2, scale: 0.6 } },
  flowers: { ground: PAINT.flowers, props: { kinds: ["flowers"], count: 2, scale: 0.7 } },
  path: { ground: PAINT.dirt },
  bridge: { ground: PAINT.planks },
  ruinFloor: { ground: PAINT.flagstones },
  tallGrass: { ground: PAINT.tallGrass, props: { kinds: ["tallGrass"], count: 4, scale: 0.8 } },
  tree: { ground: PAINT.grass, props: { kinds: ["tree"], count: 1, scale: 0.55 } },
  rock: { ground: PAINT.grass, props: { kinds: ["rock"], count: 1, scale: 0.75 } },
  water: { ground: PAINT.riverbed },
  ruinWall: { ground: PAINT.flagstones, props: { kinds: ["ruin"], count: 1, scale: 1 } },
  pad: { ground: PAINT.pad },
  marble: { ground: marble },
  carpet: { ground: carpet },
  cobbles: { ground: cobbles },
  castleWall: { ground: PAINT.flagstones },
  house: { ground: cobbles },
  foodStall: { ground: cobbles },
  potionStall: { ground: cobbles },
  forge: { ground: cobbles },
  changerStall: { ground: cobbles },
};

export const TOWN_TILES = {
  marble: KINGDOM_TILES.marble, carpet: KINGDOM_TILES.carpet, cobbles: KINGDOM_TILES.cobbles,
  castleWall: KINGDOM_TILES.castleWall, house: KINGDOM_TILES.house, foodStall: KINGDOM_TILES.foodStall,
  potionStall: KINGDOM_TILES.potionStall, forge: KINGDOM_TILES.forge, changerStall: KINGDOM_TILES.changerStall,
} satisfies Partial<TileLooks>;
