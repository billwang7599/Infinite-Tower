/**
 * What the server keeps about a player between connections. Game code only sees `PlayerStore`, so a real
 * database replaces the stub by implementing it and changing the one `new StubPlayerStore()` in main.ts.
 */
import { fullVitals, type Vitals } from "@infinite-tower/shared";

export type PlayerId = string;
/** There's no login yet, so every connection plays as the same guest. */
export const GUEST: PlayerId = "guest";

/** Add a field here and to `newPlayer` to keep something else across connections. */
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
