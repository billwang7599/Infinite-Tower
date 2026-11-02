import { mapHalfSize, seededRandom, tileAt, type LevelLayout, type Rect, type TileKind } from "@infinite-tower/shared";
import {
  groundY, SCENERY_REACH_TILES as REACH, type Ledge, type Prop, type PropKind, type Scenery,
} from "../../overworld/scenery.js";

const WALL_Y = 3;
/** Masonry this many tiles deep is the castle's bulk, not a wall, and stands taller. */
const BULK_TILES = 3;
const BULK_Y = 6;
const HOUSE_Y = { low: 2, high: 3 };
/** South of this the walls are the town's; north of it, round the castle, the land is the castle's. */
const CASTLE_SOUTH_Z = -1;
const DUMMIES = [{ x: -13.5, z: 12.5 }, { x: -12.5, z: 13.5 }];

export function kingdomScenery(level: LevelLayout): Scenery {
  const rand = seededRandom(17);
  const { halfWidth: L, halfDepth: D } = mapHalfSize(level);
  const W = L + REACH, far = D + REACH;
  const ledges: Ledge[] = [{ rect: { x: -L, z: -D, w: L * 2, h: D * 2 }, topY: 0 }];

  for (const rect of blocks(level, "castleWall")) {
    const bulk = Math.min(rect.w, rect.h) >= BULK_TILES;
    ledges.push({ rect, topY: bulk ? BULK_Y : WALL_Y, look: "castle" });
  }
  for (const rect of blocks(level, "house")) {
    ledges.push({ rect, topY: rand() < 0.5 ? HOUSE_Y.low : HOUSE_Y.high, look: "house" });
  }

  ledges.push(
    { rect: { x: -W, z: CASTLE_SOUTH_Z, w: W - L, h: D - CASTLE_SOUTH_Z }, topY: BULK_Y, look: "castle" },
    { rect: { x: L, z: CASTLE_SOUTH_Z, w: W - L, h: D - CASTLE_SOUTH_Z }, topY: BULK_Y, look: "castle" },
    { rect: { x: -W, z: D, w: W * 2, h: REACH }, topY: BULK_Y, look: "castle" },
    ...castle(D),
    { rect: { x: -W, z: -far, w: W * 2, h: REACH }, topY: 0 },
  );
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -W : L;
    ledges.push({ rect: { x: x0, z: -D, w: REACH, h: D + CASTLE_SOUTH_Z }, topY: 0 });
    for (let z = -D + 1; z < CASTLE_SOUTH_Z - 3; z += 5) {
      for (let x = x0 + 1; x < x0 + REACH - 3; x += 5) {
        const w = 3 + Math.floor(rand() * 2), h = 3 + Math.floor(rand() * 2);
        ledges.push({ rect: { x, z, w, h }, topY: rand() < 0.5 ? HOUSE_Y.low : HOUSE_Y.high, look: "house" });
      }
    }
  }

  const props: Prop[] = [];
  const add = (kind: PropKind, x: number, z: number) =>
    props.push({ kind, x, z, y: groundY(ledges, x, z), scale: 0.85 + rand() * 0.35 });
  for (let i = 0; i < 60; i++) {
    const x = (rand() * 2 - 1) * W, z = -D - 3 - rand() * (REACH - 3);
    add(rand() < 0.5 ? "bush" : "tree", x, z);
  }
  for (const { x, z } of DUMMIES) add("dummy", x, z);
  return { ledges, props };
}

function castle(D: number): Ledge[] {
  const at = (x: number, z: number, w: number, h: number, topY: number): Ledge =>
    ({ rect: { x, z: D + z, w, h }, topY, look: "castle" });
  return [
    at(-13, 1, 26, 11, 12),
    at(-17, 0, 5, 5, 17), at(12, 0, 5, 5, 17),
    at(-15, 8, 5, 5, 19), at(10, 8, 5, 5, 19),
    at(-5, 3, 10, 7, 18),
    at(-2, 5, 4, 4, 26),
  ];
}

function blocks(level: LevelLayout, kind: TileKind): Rect[] {
  const { halfWidth: L, halfDepth: D } = mapHalfSize(level), cols = L * 2, rows = D * 2;
  const is = (c: number, r: number) => tileAt(level, c - L + 0.5, D - r - 0.5) === kind;
  const taken = new Set<string>(), rects: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!is(c, r) || taken.has(`${c},${r}`)) continue;
      let w = 1, h = 1;
      while (c + w < cols && is(c + w, r) && !taken.has(`${c + w},${r}`)) w++;
      const rowMatches = (rr: number) => Array.from({ length: w }, (_, i) => c + i)
        .every((cc) => is(cc, rr) && !taken.has(`${cc},${rr}`));
      while (r + h < rows && rowMatches(r + h)) h++;
      for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) taken.add(`${cc},${rr}`);
      rects.push({ x: c - L, z: D - r - h, w, h });
    }
  }
  return rects;
}
