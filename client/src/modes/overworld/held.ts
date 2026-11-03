import {
  chunkKey, dropChunk, farChunks, putChunk, type ChunkData, type Flow, type Vec2, type WorldMap,
} from "@infinite-tower/shared";

/** The rest of the map is void. */
export interface Held {
  keys: Set<string>;
  flow: Map<string, Flow>;
  revision: number;
}

export const nothingHeld = (): Held => ({ keys: new Set(), flow: new Map(), revision: 0 });

export function hold(map: WorldMap, held: Held, chunks: readonly ChunkData[]): void {
  for (const chunk of chunks) {
    putChunk(map, held.flow, chunk);
    held.keys.add(chunkKey(chunk.x, chunk.z));
  }
  held.revision++;
}

export function dropFar(map: WorldMap, held: Held, at: Vec2): void {
  for (const { key, rect } of farChunks(held.keys, at)) {
    dropChunk(map, held.flow, rect);
    held.keys.delete(key);
    held.revision++;
  }
}
