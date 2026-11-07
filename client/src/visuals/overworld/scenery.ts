import {
  inRect, isSolid, regionAt, seededRandom, tileAt, type Rect, type TileKind, type Vec2, type Vec3, type WorldMap,
} from "@infinite-tower/shared";
import { gateMouths, houseLedges, tileBlocks, wholeRuns, type House } from "./town.js";

export type PropKind =
  | "tree" | "pine" | "deadTree" | "bush" | "rock" | "ruin" | "tuft" | "flowers" | "tallGrass" | "reeds" | "mushrooms"
  | "produce" | "potions" | "scales" | "embers" | "dummy" | "rubble" | "crane" | "cart" | "scrub" | "chips"
  | "shack" | "statue";

export interface Prop { kind: PropKind; x: number; y: number; z: number; scale: number }

export interface Awning { colors: readonly [string, string]; topY: number }

export interface Ledge {
  rect: Rect;
  topY: number;
  look?: "castle" | "column" | "house" | "counter" | "hearth" | "quarry" | "fountain" | "plinth" | "lamp" | "gate";
  awning?: Awning;
  house?: House;
  /** Crenellated all round, not only toward the open air (the keep, standing in the castle's bulk). */
  crowned?: boolean;
}

export interface Scenery {
  ledges: Ledge[];
  props: Prop[];
}

const TALL = new Set<PropKind>([
  "tree", "pine", "deadTree", "bush", "rock", "ruin", "rubble", "crane", "cart", "shack", "statue",
]);

export function isTall(kind: PropKind): boolean {
  return TALL.has(kind);
}

export function groundY(ledges: readonly Ledge[], x: number, z: number): number {
  let y = -Infinity;
  for (const l of ledges) if (inRect(l.rect, x, z) && l.topY > y) y = l.topY;
  return y === -Infinity ? 0 : y;
}

/** The chibi's own extent inside its larger sprite quad. */
const WALKER_VIEW = { halfWidthTiles: 0.4, heightTiles: 1.3 };

export function hidesWalker(ledge: Ledge, eye: Vec3, feet: Vec3): boolean {
  if ((ledge.awning?.topY ?? ledge.topY) < WALKER_VIEW.heightTiles / 2) return false;
  const away = Math.hypot(feet.x - eye.x, feet.z - eye.z) || 1;
  const rightX = (feet.z - eye.z) / away, rightZ = (eye.x - feet.x) / away;
  const topY = ledge.awning?.topY ?? ledge.topY;
  return [0, WALKER_VIEW.heightTiles].some((up) => [-1, 0, 1].some((side) => blocksView(ledge.rect, topY, eye, {
    x: feet.x + rightX * side * WALKER_VIEW.halfWidthTiles,
    y: feet.y + up,
    z: feet.z + rightZ * side * WALKER_VIEW.halfWidthTiles,
  })));
}

function blocksView(rect: Rect, topY: number, from: Vec3, to: Vec3): boolean {
  if (topY <= 0) return false;
  let t0 = 0, t1 = 1;
  const slabs: [number, number, number, number][] = [
    [from.x, to.x, rect.x, rect.x + rect.w], [from.y, to.y, -Infinity, topY], [from.z, to.z, rect.z, rect.z + rect.h],
  ];
  for (const [a, b, lo, hi] of slabs) {
    const d = b - a;
    if (d === 0) {
      if (a < lo || a > hi) return false;
      continue;
    }
    const s0 = (lo - a) / d, s1 = (hi - a) / d;
    t0 = Math.max(t0, Math.min(s0, s1));
    t1 = Math.min(t1, Math.max(s0, s1));
    if (t0 > t1) return false;
  }
  return true;
}

const WALL_Y = 3;
/** Wall filling a square this many tiles a side is the castle's bulk, and stands taller. */
const BULK_TILES = 3;
const BULK_Y = 6;
const COUNTER_Y = 0.55;
const AWNING_Y = 1.95;
const HEARTH_Y = 0.8;
const FOUNTAIN_RIM_Y = 0.6;
const PLINTH_Y = 1.3;
const STALLS: { kind: TileKind; goods: PropKind; awning?: readonly [string, string] }[] = [
  { kind: "foodStall", goods: "produce", awning: ["#e8dcc0", "#4f7a3a"] },
  { kind: "potionStall", goods: "potions", awning: ["#e8dcc0", "#5b3f8a"] },
  { kind: "changerStall", goods: "scales", awning: ["#e8dcc0", "#a8862e"] },
  { kind: "forge", goods: "embers" },
];
const TERRACE = { stepY: 1.2, tiles: 2, inQuarry: 4, ringTiles: 4, propChance: 0.18 };
const KEEP: readonly [number, number, number, number, number][] = [
  [-22, 1, 44, 12, 12], [-27, 0, 6, 6, 18], [21, 0, 6, 6, 18], [-25, 9, 6, 6, 21], [19, 9, 6, 6, 21],
  [-8, 3, 16, 8, 19], [-3, 5, 6, 5, 28], [-15, 4, 4, 4, 16], [11, 4, 4, 4, 16],
];
const DUMMIES: readonly Vec2[] = [{ x: -31.5, z: 13.5 }, { x: -30.5, z: 14.5 }];

const kindAt = (map: WorldMap, x: number, z: number) => tileAt(map, x + 0.5, z + 0.5);
const tileRandom = (x: number, z: number, salt: number) => seededRandom(salt + x * 7919 + z * 104729);

function inBulk(map: WorldMap, x: number, z: number): boolean {
  for (let x0 = x - BULK_TILES + 1; x0 <= x; x0++) {
    for (let z0 = z - BULK_TILES + 1; z0 <= z; z0++) {
      let all = true;
      for (let dx = 0; dx < BULK_TILES && all; dx++) {
        for (let dz = 0; dz < BULK_TILES && all; dz++) all = kindAt(map, x0 + dx, z0 + dz) === "castleWall";
      }
      if (all) return true;
    }
  }
  return false;
}

function terraceY(map: WorldMap, x: number, z: number): number {
  const { area } = regionAt(map, x + 0.5, z + 0.5), cx = x + 0.5, cz = z + 0.5;
  const out = Math.max(area.x - cx, cx - area.x - area.w, area.z - cz, cz - area.z - area.h);
  if (out > 0) return (TERRACE.inQuarry + 1 + Math.floor(out / TERRACE.ringTiles)) * TERRACE.stepY;
  const inset = -out - 0.5;
  return Math.max(1, TERRACE.inQuarry - Math.floor(inset / TERRACE.tiles)) * TERRACE.stepY;
}

type Block = Omit<Ledge, "rect">;

const alone = (map: WorldMap, x: number, z: number) =>
  [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => !isSolid(map, x + dx! + 0.5, z + dz! + 0.5));

function blockAt(map: WorldMap, x: number, z: number): Block | null {
  const kind = kindAt(map, x, z);
  if (kind === "castleWall") {
    if (alone(map, x, z)) return { topY: WALL_Y, look: "column" };
    return { topY: inBulk(map, x, z) ? BULK_Y : WALL_Y, look: "castle" };
  }
  if (kind === "cutStone") return { topY: terraceY(map, x, z), look: "quarry" };
  const stall = STALLS.find((s) => s.kind === kind);
  if (!stall) return null;
  return stall.awning
    ? { topY: COUNTER_Y, look: "counter", awning: { colors: stall.awning, topY: AWNING_Y } }
    : { topY: HEARTH_Y, look: "hearth" };
}

const clip = (r: Rect, to: Rect): Rect | null => {
  const x0 = Math.max(r.x, to.x), x1 = Math.min(r.x + r.w, to.x + to.w);
  const z0 = Math.max(r.z, to.z), z1 = Math.min(r.z + r.h, to.z + to.h);
  return x0 < x1 && z0 < z1 ? { x: x0, z: z0, w: x1 - x0, h: z1 - z0 } : null;
};

export function chunkScenery(map: WorldMap, chunk: Rect): Scenery {
  const keys = new Map<string, Block>(), keyAt = new Map<string, string>();
  for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
    for (let z = chunk.z; z < chunk.z + chunk.h; z++) {
      const block = blockAt(map, x, z);
      if (!block) continue;
      const key = JSON.stringify(block);
      keys.set(key, block);
      keyAt.set(`${x},${z}`, key);
    }
  }
  const ledges: Ledge[] = [{ rect: chunk, topY: 0 }];
  for (const [key, block] of keys) {
    for (const rect of tileBlocks(chunk, (x, z) => keyAt.get(`${Math.floor(x)},${Math.floor(z)}`) === key)) {
      ledges.push({ rect, ...block });
    }
  }
  ledges.push(...houseLedges(map, chunk));
  for (const rect of wholeRuns(map, chunk, "fountain")) ledges.push({ rect, topY: FOUNTAIN_RIM_Y, look: "fountain" });
  for (const rect of wholeRuns(map, chunk, "statue")) ledges.push({ rect, topY: PLINTH_Y, look: "plinth" });
  for (const rect of wholeRuns(map, chunk, "lamp")) ledges.push({ rect, topY: 0, look: "lamp" });
  ledges.push(...gateMouths(map, chunk, (x, z) => blockAt(map, x, z)?.topY ?? WALL_Y));
  const castle = map.regions.find((r) => r.id === "kingdom");
  if (castle) {
    const midX = castle.area.x + castle.area.w / 2, northZ = castle.area.z + castle.area.h;
    for (const [x, z, w, h, topY] of KEEP) {
      const rect = clip({ x: midX + x, z: northZ + z, w, h }, chunk);
      if (rect) ledges.push({ rect, topY, look: "castle", crowned: true });
    }
  }

  const props: Prop[] = [];
  const add = (kind: PropKind, x: number, z: number, rand: () => number) =>
    props.push({ kind, x, z, y: groundY(ledges, x, z), scale: 0.85 + rand() * 0.35 });
  if (castle) {
    const mid = { x: castle.area.x + castle.area.w / 2, z: castle.area.z + castle.area.h / 2 };
    DUMMIES.forEach((d, i) => {
      const x = mid.x + d.x, z = mid.z + d.z;
      if (x >= chunk.x && x < chunk.x + chunk.w && z >= chunk.z && z < chunk.z + chunk.h) {
        add("dummy", x, z, seededRandom(17 + i));
      }
    });
  }
  for (let x = chunk.x; x < chunk.x + chunk.w; x++) {
    for (let z = chunk.z; z < chunk.z + chunk.h; z++) {
      const kind = kindAt(map, x, z), rand = tileRandom(x, z, 3);
      const stall = STALLS.find((s) => s.kind === kind);
      if (stall) add(stall.goods, x + 0.5, z + 0.5, rand);
      if (kind === "cutStone" && rand() < TERRACE.propChance) add(rand() < 0.6 ? "chips" : "scrub", x + 0.5, z + 0.5, rand);
    }
  }
  for (const l of ledges) {
    if (l.look !== "plinth") continue;
    const x = l.rect.x + l.rect.w / 2, z = l.rect.z + l.rect.h / 2;
    props.push({ kind: "statue", x, z, y: l.topY, scale: Math.min(l.rect.w, l.rect.h) / 2 });
  }
  return { ledges, props };
}
