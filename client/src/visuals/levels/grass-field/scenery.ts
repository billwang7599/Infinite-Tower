import { mapHalfSize, seededRandom, type LevelLayout } from "@infinite-tower/shared";
import { groundY, type Ledge, type Prop, type PropKind, type Scenery } from "../../overworld/scenery.js";

/** Tiles past the level's edge the scenery reaches: more than the camera can show. */
const REACH = 16;
const NORTH_STEP_TILES = 4;
const LEDGE_Y = { low: -2.5, high: 2.5, higher: 5 };

export function grassFieldScenery(level: LevelLayout): Scenery {
  const rand = seededRandom(23);
  const { halfWidth: L, halfDepth: D } = mapHalfSize(level);
  const ledges = gridLedges(L, D, rand);
  const props: Prop[] = [];
  const add = (kind: PropKind, x: number, z: number) =>
    props.push({ kind, x, z, y: groundY(ledges, x, z), scale: 0.85 + rand() * 0.35 });

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
  return { ledges, props };
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
