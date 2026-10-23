import { newPlayer, type PlayerSave, type PlayerStore } from "./player-store.js";

/** Stand-in until there's a database: every load is a new player (full HP and stamina) and saves go nowhere. */
export class StubPlayerStore implements PlayerStore {
  async load(): Promise<PlayerSave> {
    return newPlayer();
  }

  async save(): Promise<void> {}
}
