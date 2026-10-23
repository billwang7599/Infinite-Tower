/**
 * What the server keeps about a player between connections. Game code only sees `PlayerStore`; main.ts
 * picks the implementation (Postgres, pg-player-store.ts), so swapping it is a one-line change there.
 */
import { fullVitals, type Character, type SavedSettings, type Vitals } from "@infinite-tower/shared";
import { PLAYER_STATS } from "../content/player.js";

/** The account's id: every player logs in (auth/), there's no guest play. */
export type PlayerId = string;

/** To keep something else across connections: add it here, to `newPlayer`, and a column (a new migration). */
export interface PlayerSave {
  vitals: Vitals;
  /** Fights won. */
  wins: number;
  settings: SavedSettings;
  /** null until they've made one (their first visit). */
  character: Character | null;
}

/** A player the store has never seen. */
export const newPlayer = (): PlayerSave => ({ vitals: fullVitals(PLAYER_STATS), wins: 0, settings: {}, character: null });

export interface PlayerStore {
  /** Resolves to `newPlayer()` for an unknown id. */
  load(id: PlayerId): Promise<PlayerSave>;
  save(id: PlayerId, data: PlayerSave): Promise<void>;
}
