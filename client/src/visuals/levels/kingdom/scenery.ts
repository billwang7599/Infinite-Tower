import { mapHalfSize, seededRandom, tileAt, type LevelLayout, type TileKind, type Vec2 } from "@infinite-tower/shared";
import {
  groundY, SCENERY_REACH_TILES as REACH, tileBlocks, type Ledge, type Prop, type PropKind, type Scenery,
} from "../../overworld/scenery.js";

const WALL_Y = 3;
/** Masonry this many tiles deep is the castle's bulk, not a wall, and stands taller. */
const BULK_TILES = 3;
const BULK_Y = 6;
const HOUSE_Y = { low: 2, high: 3 };
/** By level: the share of each side, from the north, that is castle rather than rooftops; the yard's dummies. */
const WARDS: Record<string, { castleShare: number; dummies: readonly Vec2[] }> = {
  kingdom: { castleShare: 1, dummies: [{ x: -17.5, z: 10.5 }, { x: -16.5, z: 11.5 }] },
  "market-ward": { castleShare: 0, dummies: [] },
};
const COUNTER_Y = 0.55;
const AWNING_Y = 1.95;
const HEARTH_Y = 0.8;
const STALLS: { kind: TileKind; goods: PropKind; awning?: readonly [string, string] }[] = [
  { kind: "foodStall", goods: "produce", awning: ["#e8dcc0", "#4f7a3a"] },
  { kind: "potionStall", goods: "potions", awning: ["#e8dcc0", "#5b3f8a"] },
  { kind: "changerStall", goods: "scales", awning: ["#e8dcc0", "#a8862e"] },
  { kind: "forge", goods: "embers" },
];

const blocks = (level: LevelLayout, kind: TileKind) => tileBlocks(level, (x, z) => tileAt(level, x, z) === kind);

export function kingdomScenery(level: LevelLayout): Scenery {
  const rand = seededRandom(17);
  const { halfWidth: L, halfDepth: D } = mapHalfSize(level);
  const W = L + REACH, far = D + REACH;
  const ward = WARDS[level.id] ?? WARDS["market-ward"]!, castleSouthZ = D - 2 * D * ward.castleShare;
  const ledges: Ledge[] = [{ rect: { x: -L, z: -D, w: L * 2, h: D * 2 }, topY: 0 }];

  for (const rect of blocks(level, "castleWall")) {
    const bulk = Math.min(rect.w, rect.h) >= BULK_TILES;
    ledges.push({ rect, topY: bulk ? BULK_Y : WALL_Y, look: "castle" });
  }
  for (const rect of blocks(level, "house")) {
    ledges.push({ rect, topY: rand() < 0.5 ? HOUSE_Y.low : HOUSE_Y.high, look: "house" });
  }
  for (const { kind, awning } of STALLS) {
    for (const rect of blocks(level, kind)) {
      ledges.push(awning
        ? { rect, topY: COUNTER_Y, look: "counter", awning: { colors: awning, topY: AWNING_Y } }
        : { rect, topY: HEARTH_Y, look: "hearth" });
    }
  }

  ledges.push(
    { rect: { x: -W, z: castleSouthZ, w: W - L, h: D - castleSouthZ }, topY: BULK_Y, look: "castle" },
    { rect: { x: L, z: castleSouthZ, w: W - L, h: D - castleSouthZ }, topY: BULK_Y, look: "castle" },
    { rect: { x: -W, z: D, w: W * 2, h: REACH }, topY: BULK_Y, look: "castle" },
    ...castle(D),
    { rect: { x: -W, z: -far, w: W * 2, h: REACH }, topY: 0 },
  );
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -W : L;
    ledges.push({ rect: { x: x0, z: -D, w: REACH, h: D + castleSouthZ }, topY: 0 });
    for (let z = -D + 1; z < castleSouthZ - 3; z += 5) {
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
  for (const { x, z } of ward.dummies) add("dummy", x, z);
  for (const { kind, goods } of STALLS) {
    for (const rect of blocks(level, kind)) {
      for (let x = rect.x + 0.5; x < rect.x + rect.w; x++) for (let z = rect.z + 0.5; z < rect.z + rect.h; z++) add(goods, x, z);
    }
  }
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
