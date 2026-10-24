/**
 * What the server keeps about a player between connections. Game code only sees `PlayerStore`; main.ts
 * picks the implementation (Postgres, pg-player-store.ts), so swapping it is a one-line change there.
 */
import { fullVitals, type Vitals } from "@infinite-tower/shared";

export type PlayerId = string;
/** There's no login yet, so every connection plays as the same guest. */
export const GUEST: PlayerId = "guest";

/** To keep something else across connections: add it here, to `newPlayer`, and a column (a new migration). */
export interface PlayerSave {
  vitals: Vitals;
}

/** A player the store has never seen. */
export const newPlayer = (): PlayerSave => ({ vitals: fullVitals() });

export interface PlayerStore {
  /** Resolves to `newPlayer()` for an unknown id. */
  load(id: PlayerId): Promise<PlayerSave>;
  save(id: PlayerId, data: PlayerSave): Promise<void>;
}
