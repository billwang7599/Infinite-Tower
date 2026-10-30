import { groundPainters } from "../ground.js";
import type { TileLooks } from "../tiles.js";

const PAINT = groundPainters({
  grass: { base: "#2f3d2e", light: "#3a4a36", dark: "#263226", blade: "#405238", tip: "#5a6a48" },
  tall: { base: "#27352a", dark: "#1e2a21", mid: "#34473a", light: "#4a5e46", tip: "#7c7a52" },
  dirt: { base: "#4a3e33", dark: "#3b3129", light: "#57493b", pebble: "#6a5f52", edge: "#2f2720" },
  bed: { base: "#3a3628", dark: "#2b281e", pebble: "#4d4836", stone: "#5e5844", weed: "#34452a", foot: "#1f1c15" },
  wood: { base: "#4f3d2c", dark: "#33271c", light: "#63503a", rail: "#2a1f16" },
  stone: { base: "#55585a", dark: "#3d4042", light: "#686b6a", moss: "#3f5a3a" },
  petals: ["#9fd8c8", "#c8b6e2", "#d8e6b0"],
});

export const MISTWOOD_TILES: TileLooks = {
  grass: { ground: PAINT.grass, props: { kinds: ["tuft"], count: 0.25, scale: 0.6 } },
  flowers: { ground: PAINT.flowers, props: { kinds: ["mushrooms"], count: 2, scale: 0.7 } },
  path: { ground: PAINT.dirt },
  bridge: { ground: PAINT.planks },
  ruinFloor: { ground: PAINT.flagstones },
  tallGrass: { ground: PAINT.tallGrass, props: { kinds: ["reeds"], count: 3, scale: 0.85 } },
  tree: { ground: PAINT.grass, props: { kinds: ["pine", "pine", "deadTree"], count: 1, scale: 0.65 } },
  rock: { ground: PAINT.grass, props: { kinds: ["rock"], count: 1, scale: 0.75 } },
  water: { ground: PAINT.riverbed },
  ruinWall: { ground: PAINT.flagstones, props: { kinds: ["ruin"], count: 1, scale: 1 } },
};
