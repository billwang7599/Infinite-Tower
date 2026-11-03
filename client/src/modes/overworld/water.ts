import {
  clamp, FLOW, flowKey, shoreDistance, tileAt, waterFlow, type Flow, type WorldMap,
} from "@infinite-tower/shared";

/** Below the ground beside it: the surface, and the bed below the surface at the bank and at its deepest. */
export const WATER_DEPTH_TILES = { surface: 0.12, bank: 0.3, deep: 1.1 };
const SLOPE_TILES = 2.5;

export interface WaterPoint { flowX: number; flowZ: number; shore: number; depth: number }

interface At { x: number; z: number }

export interface Bank { from: At; to: At; toLand: At }

export interface WaterMap {
  tiles: At[];
  running: At[];
  still: At[];
  banks: Bank[];
  at(x: number, z: number): WaterPoint;
}

/** `flow`: worked out over the whole world (the server sends it with each chunk), else over this map alone. */
export function waterMap(
  map: Pick<WorldMap, "bounds" | "tiles">, flow: ReadonlyMap<string, Flow> = waterFlow(map),
): WaterMap {
  const wetAt = (x: number, z: number) => tileAt(map, x + 0.5, z + 0.5) === "water";
  const tiles: At[] = [], running: At[] = [], still: At[] = [], banks: Bank[] = [];
  for (const [key, { runs }] of flow) {
    const [x, z] = key.split(",").map(Number) as [number, number];
    if (!wetAt(x, z)) continue;
    tiles.push({ x, z });
    (runs ? running : still).push({ x, z });
    if (!wetAt(x, z + 1)) banks.push({ from: { x, z: z + 1 }, to: { x: x + 1, z: z + 1 }, toLand: { x: 0, z: 1 } });
    if (!wetAt(x, z - 1)) banks.push({ from: { x, z }, to: { x: x + 1, z }, toLand: { x: 0, z: -1 } });
    if (!wetAt(x - 1, z)) banks.push({ from: { x, z }, to: { x, z: z + 1 }, toLand: { x: -1, z: 0 } });
    if (!wetAt(x + 1, z)) banks.push({ from: { x: x + 1, z }, to: { x: x + 1, z: z + 1 }, toLand: { x: 1, z: 0 } });
  }
  // The shore is measured on the grid, rows counting south from z = 0.
  const wet = (c: number, r: number) => wetAt(c, -r - 1);
  return {
    tiles, running, still, banks,
    at(x, z) {
      const shore = shoreDistance(wet, x, -z);
      const x0 = Math.floor(x - 0.5), z0 = Math.floor(z - 0.5), fx = x - 0.5 - x0, fz = z - 0.5 - z0;
      let sumU = 0, sumV = 0, weight = 0;
      for (const [dx, dz, w] of [[0, 0, (1 - fx) * (1 - fz)], [1, 0, fx * (1 - fz)], [0, 1, (1 - fx) * fz],
        [1, 1, fx * fz]] as const) {
        const cell = flow.get(flowKey(x0 + dx, z0 + dz));
        if (!cell || w === 0) continue;
        sumU += cell.u * w;
        sumV += cell.v * w;
        weight += w;
      }
      const keep = weight > 0 ? (FLOW.atBankShare + (1 - FLOW.atBankShare) * Math.min(1, shore)) / weight : 0;
      const t = clamp(shore / SLOPE_TILES, 0, 1);
      return {
        flowX: sumU * keep, flowZ: -sumV * keep, shore,
        depth: WATER_DEPTH_TILES.bank + (WATER_DEPTH_TILES.deep - WATER_DEPTH_TILES.bank) * t * t * (3 - 2 * t),
      };
    },
  };
}
