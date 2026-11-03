import { groundPainters } from "../ground.js";
import { TOWN_TILES } from "../kingdom/tiles.js";
import { QUARRY_WORKINGS } from "../quarry/tiles.js";
import type { TileLooks } from "../tiles.js";

const PAINT = groundPainters({
  grass: { base: "#4a6338", light: "#56703f", dark: "#3f5631", blade: "#61793f", tip: "#7f8f52" },
  tall: { base: "#2f4a2b", dark: "#253c23", mid: "#40613a", light: "#58784a", tip: "#86935a" },
  dirt: { base: "#6f5a43", dark: "#5c4a38", light: "#82694d", pebble: "#958673", edge: "#4c3d2f" },
  bed: { base: "#5a5340", dark: "#463f30", pebble: "#746c58", stone: "#8d846c", weed: "#46562f", foot: "#2f2a20" },
  wood: { base: "#6a4b30", dark: "#4a3322", light: "#836042", rail: "#3a281b" },
  stone: { base: "#6a6762", dark: "#4b4945", light: "#807c75", moss: "#53663c" },
  pad: { base: "#8a867c", dark: "#5e5b54", light: "#a29d91", rune: "#9ad6cf" },
  petals: ["#d9d2bd", "#d6b45a", "#c57f92", "#8ea0c9"],
});

export const GRASS_FIELD_TILES: TileLooks = {
  grass: { ground: PAINT.grass, props: { kinds: ["tuft"], count: 0.3, scale: 0.6 } },
  flowers: { ground: PAINT.flowers, props: { kinds: ["flowers"], count: 2, scale: 0.7 } },
  path: { ground: PAINT.dirt },
  bridge: { ground: PAINT.planks },
  ruinFloor: { ground: PAINT.flagstones },
  tallGrass: { ground: PAINT.tallGrass, props: { kinds: ["tallGrass"], count: 4, scale: 0.8 } },
  tree: { ground: PAINT.grass, props: { kinds: ["tree", "tree", "pine"], count: 1, scale: 0.6 } },
  rock: { ground: PAINT.grass, props: { kinds: ["rock"], count: 1, scale: 0.75 } },
  water: { ground: PAINT.riverbed },
  ruinWall: { ground: PAINT.flagstones, props: { kinds: ["ruin"], count: 1, scale: 1 } },
  pad: { ground: PAINT.pad },
  ...TOWN_TILES,
  ...QUARRY_WORKINGS,
};
