import { CHUNK_TILES, type Rect, type WorldMap } from "./layout.js";
import { TILES } from "./tiles.js";
import { flowKey, type Flow } from "./water.js";

/** The server sends every chunk this near you, so the client can build those it draws before you reach them. */
export const CHUNK_SEND_TILES = 64;
/** Past this the client drops a chunk and the server forgets it sent it: further than SEND, so none flickers. */
export const CHUNK_DROP_TILES = 80;
const VOID = " ";
const FLOW_SCALE = 1000;

/** `rows` north first, null when it's all void; `flow`: u, v and runs (0 or 1) of each water or bridge tile in it,
 * north row first, × FLOW_SCALE. */
export interface ChunkData { x: number; z: number; rows: string[] | null; flow: number[] }

export const chunkKey = (x: number, z: number) => `${x},${z}`;

export const distToRect = (r: Rect, x: number, z: number) =>
  Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.z - z, 0, z - r.z - r.h));

export function chunksNear(bounds: Rect, x: number, z: number, radius: number): Rect[] {
  const near: Rect[] = [];
  for (let cx = bounds.x; cx < bounds.x + bounds.w; cx += CHUNK_TILES) {
    for (let cz = bounds.z; cz < bounds.z + bounds.h; cz += CHUNK_TILES) {
      const rect = { x: cx, z: cz, w: CHUNK_TILES, h: CHUNK_TILES };
      if (distToRect(rect, x, z) <= radius) near.push(rect);
    }
  }
  return near;
}

const rowOf = (map: Pick<WorldMap, "bounds">, z: number) => map.bounds.z + map.bounds.h - 1 - z;

export function chunkData(
  map: Pick<WorldMap, "bounds" | "tiles">, flow: ReadonlyMap<string, Flow>, rect: Rect,
): ChunkData {
  const col = rect.x - map.bounds.x, rows: string[] = [], packed: number[] = [];
  for (let z = rect.z + rect.h - 1; z >= rect.z; z--) {
    rows.push(map.tiles[rowOf(map, z)]!.slice(col, col + rect.w));
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const f = flow.get(flowKey(x, z));
      if (f) packed.push(Math.round(f.u * FLOW_SCALE), Math.round(f.v * FLOW_SCALE), f.runs ? 1 : 0);
    }
  }
  const empty = rows.every((r) => r.trim() === "");
  return { x: rect.x, z: rect.z, rows: empty ? null : rows, flow: packed };
}

const blank = (n: number) => VOID.repeat(n);

function writeRow(map: WorldMap, z: number, x: number, text: string): void {
  const r = rowOf(map, z), col = x - map.bounds.x, row = map.tiles[r]!;
  map.tiles[r] = row.slice(0, col) + text + row.slice(col + text.length);
}

export function emptyTiles(bounds: Rect): string[] {
  return Array.from({ length: bounds.h }, () => blank(bounds.w));
}

/** Into `map` and `flow`, in place. */
export function putChunk(map: WorldMap, flow: Map<string, Flow>, data: ChunkData): void {
  let k = 0;
  for (let i = 0; i < CHUNK_TILES; i++) {
    const z = data.z + CHUNK_TILES - 1 - i, row = data.rows?.[i] ?? blank(CHUNK_TILES);
    writeRow(map, z, data.x, row);
    for (let c = 0; c < CHUNK_TILES; c++) {
      if (row[c] !== TILES.water.char && row[c] !== TILES.bridge.char) continue;
      const [u, v, runs] = data.flow.slice(k, k += 3) as [number, number, number];
      flow.set(flowKey(data.x + c, z), { u: u / FLOW_SCALE, v: v / FLOW_SCALE, runs: runs === 1 });
    }
  }
}

export function dropChunk(map: WorldMap, flow: Map<string, Flow>, rect: Rect): void {
  for (let z = rect.z; z < rect.z + rect.h; z++) {
    writeRow(map, z, rect.x, blank(rect.w));
    for (let x = rect.x; x < rect.x + rect.w; x++) flow.delete(flowKey(x, z));
  }
}
