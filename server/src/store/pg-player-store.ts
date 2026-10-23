import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/db.js";
import { players } from "../db/schema.js";
import { newPlayer, type PlayerId, type PlayerSave, type PlayerStore } from "./player-store.js";

/** Players in Postgres: the `players` table (db/schema.ts). */
export class PgPlayerStore implements PlayerStore {
  /**
   * Each player's latest queued query. Loads and saves for one player run one after another, so an older
   * save can't land after a newer one, and reconnecting reads what the last connection saved.
   */
  private readonly last = new Map<PlayerId, Promise<unknown>>();

  constructor(private readonly db: Db) {}

  load(id: PlayerId): Promise<PlayerSave> {
    return this.inOrder(id, async () => {
      const [row] = await this.db.select().from(players).where(eq(players.id, id));
      return row ? fromRow(row) : newPlayer();
    });
  }

  save(id: PlayerId, data: PlayerSave): Promise<void> {
    return this.inOrder(id, async () => {
      const row = toRow(data);
      await this.db.insert(players).values({ id, ...row })
        .onConflictDoUpdate({ target: players.id, set: { ...row, updatedAt: sql`now()` } });
    });
  }

  private inOrder<T>(id: PlayerId, query: () => Promise<T>): Promise<T> {
    const next = (this.last.get(id) ?? Promise.resolve()).catch(() => {}).then(query);
    this.last.set(id, next);
    const forget = () => { if (this.last.get(id) === next) this.last.delete(id); };
    next.then(forget, forget);
    return next;
  }
}

/**
 * A save's columns: all of them but the id and the timestamp. Required, so a new column that `toRow` forgets is a
 * type error rather than a default that's silently saved forever. Keeping something new means a line in each.
 */
type PlayerRow = Required<Omit<typeof players.$inferInsert, "id" | "updatedAt">>;

const toRow = (data: PlayerSave): PlayerRow => ({
  hp: data.vitals.hp, stamina: data.vitals.stamina, wins: data.wins, settings: data.settings,
});

const fromRow = (row: typeof players.$inferSelect): PlayerSave => ({
  vitals: { hp: row.hp, stamina: row.stamina }, wins: row.wins, settings: row.settings,
});
