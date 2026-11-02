import type { LevelMap } from "./layout.js";

export interface TileRule {
  char: string;
  solid: boolean;
  tallGrass: boolean;
}

export const TILES = {
  grass: { char: ".", solid: false, tallGrass: false },
  flowers: { char: "*", solid: false, tallGrass: false },
  path: { char: ":", solid: false, tallGrass: false },
  bridge: { char: "=", solid: false, tallGrass: false },
  ruinFloor: { char: "_", solid: false, tallGrass: false },
  tallGrass: { char: '"', solid: false, tallGrass: true },
  pad: { char: "@", solid: false, tallGrass: false },
  marble: { char: "+", solid: false, tallGrass: false },
  carpet: { char: "%", solid: false, tallGrass: false },
  cobbles: { char: ";", solid: false, tallGrass: false },
  tree: { char: "T", solid: true, tallGrass: false },
  rock: { char: "o", solid: true, tallGrass: false },
  water: { char: "~", solid: true, tallGrass: false },
  ruinWall: { char: "#", solid: true, tallGrass: false },
  castleWall: { char: "W", solid: true, tallGrass: false },
  house: { char: "H", solid: true, tallGrass: false },
  foodStall: { char: "F", solid: true, tallGrass: false },
  potionStall: { char: "P", solid: true, tallGrass: false },
  forge: { char: "A", solid: true, tallGrass: false },
  changerStall: { char: "C", solid: true, tallGrass: false },
  cutStone: { char: "Q", solid: true, tallGrass: false },
  cart: { char: "K", solid: true, tallGrass: false },
  crane: { char: "Y", solid: true, tallGrass: false },
} as const satisfies Record<string, TileRule>;

export type TileKind = keyof typeof TILES;

const KIND_BY_CHAR = new Map<string, TileKind>(
  Object.entries(TILES).map(([kind, rule]) => [rule.char, kind as TileKind]),
);

export function mapHalfSize(level: LevelMap): { halfWidth: number; halfDepth: number } {
  return { halfWidth: (level.tiles[0]?.length ?? 0) / 2, halfDepth: level.tiles.length / 2 };
}

/** Null outside the map (or for a character no kind uses). */
export function tileAt(level: LevelMap, x: number, z: number): TileKind | null {
  const { halfWidth, halfDepth } = mapHalfSize(level);
  const char = level.tiles[Math.floor(halfDepth - z)]?.[Math.floor(x + halfWidth)];
  return char === undefined ? null : KIND_BY_CHAR.get(char) ?? null;
}

export function isSolid(level: LevelMap, x: number, z: number): boolean {
  const kind = tileAt(level, x, z);
  return kind === null || TILES[kind].solid;
}

export function inTallGrass(level: LevelMap, x: number, z: number): boolean {
  const kind = tileAt(level, x, z);
  return kind !== null && TILES[kind].tallGrass;
}
