import { mapHalfSize, seededRandom, type LevelLayout } from "@infinite-tower/shared";
import {
  groundY, SCENERY_REACH_TILES as REACH, type Ledge, type Prop, type PropKind, type Scenery,
} from "../../overworld/scenery.js";

const BANK_Y = { side: 1.5, north: 3, south: -1.5 };
const TREES = 620;

export function mistwoodScenery(level: LevelLayout): Scenery {
  const rand = seededRandom(41);
  const { halfWidth: L, halfDepth: D } = mapHalfSize(level);
  const W = L + REACH, far = D + REACH;
  const ledges: Ledge[] = [
    { rect: { x: -L, z: -D, w: L * 2, h: D * 2 }, topY: 0 },
    { rect: { x: -W, z: D, w: W * 2, h: REACH }, topY: BANK_Y.north },
    { rect: { x: -W, z: -far, w: W * 2, h: REACH }, topY: BANK_Y.south },
    { rect: { x: -W, z: -D, w: REACH, h: D * 2 }, topY: BANK_Y.side },
    { rect: { x: L, z: -D, w: REACH, h: D * 2 }, topY: BANK_Y.side },
  ];
  const props: Prop[] = [];
  const add = (kind: PropKind, x: number, z: number) =>
    props.push({ kind, x, z, y: groundY(ledges, x, z), scale: 0.85 + rand() * 0.35 });
  for (let i = 0; i < TREES; i++) {
    const x = (rand() * 2 - 1) * W, z = (rand() * 2 - 1) * far, pick = rand();
    if (Math.abs(x) < L + 0.8 && Math.abs(z) < D + 0.8) continue;
    add(pick < 0.6 ? "pine" : pick < 0.85 ? "deadTree" : "bush", x, z);
  }
  return { ledges, props };
}
