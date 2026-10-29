import { inRect, inTallGrass, seededRandom, type LevelLayout, type Rect } from "@infinite-tower/shared";
import { groundY, walkable, type Ledge, type Prop, type PropKind, type Scenery } from "../../overworld3d/scenery.js";

/** Tiles past the level's edge the scenery reaches: more than the camera can show. */
const REACH = 16;
const NORTH_STEP_TILES = 4;
const LEDGE_Y = { low: -2.5, high: 2.5, higher: 5 };
const ROAD_WIDTH = 2;
/** Props that stand up like obstacles stay this far out of where you can walk. */
const CLEARANCE = 0.4;

export function grassFieldScenery(level: LevelLayout): Scenery {
  const rand = seededRandom(23);
  const L = level.halfWidth, D = level.halfDepth;
  const ledges = gridLedges(L, D, rand);
  const roadZ = level.campfires[0]?.z ?? 0;
  const paths: Rect[] = [{ x: -L, z: roadZ - ROAD_WIDTH / 2, w: L * 2, h: ROAD_WIDTH }];
  const props: Prop[] = [];
  const add = (kind: PropKind, x: number, z: number, scale = 0.85 + rand() * 0.35) =>
    props.push({ kind, x, z, y: groundY(ledges, x, z), scale });
  const keepsOut = (x: number, z: number) => !inRect(grow(walkable(level), CLEARANCE), x, z);
  const onRoad = (x: number, z: number) => paths.some((p) => inRect(grow(p, 0.3), x, z));

  for (let i = 0; i < 260; i++) {
    const x = (rand() * 2 - 1) * (L + REACH), z = D + 0.8 + rand() * 11;
    add(rand() < 0.35 ? "pine" : "tree", x, z);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 70; i++) {
      const x = side * (L + 0.8 + rand() * (REACH - 1)), z = -D + rand() * D * 2;
      add(rand() < 0.3 ? "pine" : "tree", x, z);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = (rand() * 2 - 1) * (L + REACH), z = -D - 3 - rand() * (REACH - 3);
    add(rand() < 0.6 ? "bush" : "tree", x, z);
  }

  const strip = level.border - CLEARANCE;
  for (let i = 0; i < 70; i++) {
    const across = rand() * strip, side = rand();
    const [x, z] = side < 0.5 ? [(rand() * 2 - 1) * L, D - across]
      : [(side < 0.75 ? -1 : 1) * (L - across), (rand() * 2 - 1) * D];
    if (keepsOut(x, z) && !onRoad(x, z)) add(rand() < 0.4 ? "rock" : "bush", x, z, 0.7 + rand() * 0.5);
  }
  for (let x = -L + 1; x < L; x += 2) if (!onRoad(x, -D + 0.5)) add("fence", x, -D + 0.5, 1);
  for (const x of [-L + 0.6, L - 0.6]) for (const dz of [-ROAD_WIDTH / 2 - 0.4, ROAD_WIDTH / 2 + 0.4]) {
    add("banner", x, roadZ + dz, 1);
  }

  for (let i = 0; i < 170; i++) {
    const x = (rand() * 2 - 1) * L, z = (rand() * 2 - 1) * D;
    if (onRoad(x, z) || inTallGrass(level, x, z)) continue;
    add(rand() < 0.3 ? "flowers" : "tuft", x, z, 0.6 + rand() * 0.4);
  }
  for (const g of level.grass) {
    for (let gz = g.z + 0.15; gz <= g.z + g.h; gz += 0.4) {
      for (let gx = g.x + 0.1; gx <= g.x + g.w - 0.25; gx += 0.45) add("tallGrass", gx + rand() * 0.25, gz, 0.9 + rand() * 0.3);
    }
  }
  return { ledges, paths, props };
}

function gridLedges(L: number, D: number, rand: () => number): Ledge[] {
  const W = L + REACH, far = D + REACH;
  const ledges: Ledge[] = [
    { rect: { x: -L, z: -D, w: L * 2, h: D * 2 }, topY: 0 },
    { rect: { x: -W, z: D, w: W * 2, h: 1 }, topY: 0 },
    { rect: { x: -W, z: -far, w: W * 2, h: far - D }, topY: LEDGE_Y.low },
    { rect: { x: -W, z: -D, w: W - L, h: D * 2 }, topY: LEDGE_Y.high },
    { rect: { x: L, z: -D, w: W - L, h: D * 2 }, topY: LEDGE_Y.high },
  ];
  for (let x = -W; x < W;) {
    const w = Math.min(4 + rand() * 6, W - x), back = rand() * 0.8, step = NORTH_STEP_TILES + rand() * 1.5;
    ledges.push({ rect: { x, z: D + back, w, h: step - back }, topY: LEDGE_Y.high });
    ledges.push({ rect: { x, z: D + step, w, h: far - D - step }, topY: LEDGE_Y.higher });
    x += w;
  }
  return ledges;
}

function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, z: r.z - by, w: r.w + by * 2, h: r.h + by * 2 };
}
