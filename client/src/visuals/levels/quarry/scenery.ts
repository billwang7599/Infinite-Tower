import { mapHalfSize, seededRandom, tileAt, type LevelLayout } from "@infinite-tower/shared";
import {
  groundY, SCENERY_REACH_TILES as REACH, tileBlocks, type Ledge, type Prop, type PropKind, type Scenery,
} from "../../overworld/scenery.js";

const TERRACE_STEP_Y = 1.2;
const TERRACE_TILES = 2;
const TERRACES_ON_MAP = 4;
const RING_TILES = 4;
const OUTER_PROPS = 220;
const TERRACE_PROP_CHANCE = 0.18;

export function quarryScenery(level: LevelLayout): Scenery {
  const rand = seededRandom(53);
  const { halfWidth: L, halfDepth: D } = mapHalfSize(level);
  const terrace = (x: number, z: number) => {
    const inset = Math.min(x + L, L - x, z + D, D - z) - 0.5;
    return Math.max(1, TERRACES_ON_MAP - Math.floor(inset / TERRACE_TILES));
  };
  const isStone = (x: number, z: number) => tileAt(level, x, z) === "cutStone";

  const ledges: Ledge[] = [{ rect: { x: -L, z: -D, w: L * 2, h: D * 2 }, topY: 0 }];
  for (let step = 1; step <= TERRACES_ON_MAP; step++) {
    for (const rect of tileBlocks(level, (x, z) => isStone(x, z) && terrace(x, z) === step)) {
      ledges.push({ rect, topY: step * TERRACE_STEP_Y, look: "quarry" });
    }
  }
  for (let ring = 0; ring * RING_TILES < REACH; ring++) {
    const inX = L + ring * RING_TILES, inZ = D + ring * RING_TILES, outX = inX + RING_TILES, outZ = inZ + RING_TILES;
    const topY = (TERRACES_ON_MAP + ring + 1) * TERRACE_STEP_Y, look = "quarry" as const;
    ledges.push(
      { rect: { x: -outX, z: inZ, w: outX * 2, h: RING_TILES }, topY, look },
      { rect: { x: -outX, z: -outZ, w: outX * 2, h: RING_TILES }, topY, look },
      { rect: { x: -outX, z: -inZ, w: RING_TILES, h: inZ * 2 }, topY, look },
      { rect: { x: inX, z: -inZ, w: RING_TILES, h: inZ * 2 }, topY, look },
    );
  }

  const props: Prop[] = [];
  const add = (kind: PropKind, x: number, z: number) =>
    props.push({ kind, x, z, y: groundY(ledges, x, z), scale: 0.85 + rand() * 0.35 });
  const W = L + REACH, far = D + REACH;
  for (let i = 0; i < OUTER_PROPS; i++) {
    const x = (rand() * 2 - 1) * W, z = (rand() * 2 - 1) * far, pick = rand();
    if (Math.abs(x) < L + 0.6 && Math.abs(z) < D + 0.6) continue;
    add(pick < 0.4 ? "rubble" : pick < 0.65 ? "scrub" : pick < 0.85 ? "pine" : "deadTree", x, z);
  }
  for (let x = -L + 0.5; x < L; x++) {
    for (let z = -D + 0.5; z < D; z++) {
      if (isStone(x, z) && rand() < TERRACE_PROP_CHANCE) add(rand() < 0.6 ? "chips" : "scrub", x, z);
    }
  }
  return { ledges, props };
}
