import type { ItemId } from "@infinite-tower/shared";
import { eq, sql } from "drizzle-orm";
import type { PlayerId, PlayerSave, PlayerStore, StoredSave, UniqueHold } from "../core/ports.js";
import type { Db } from "./db.js";
import { players, uniqueItems } from "./schema.js";

/** Players in Postgres: the `players` table (schema.ts). */
export class PgPlayerStore implements PlayerStore {
  /** Each player's latest query: one player's loads and saves run in order, so an older save can't land last. */
  private readonly last = new Map<PlayerId, Promise<unknown>>();

  constructor(private readonly db: Db) {}

  load(id: PlayerId): Promise<StoredSave | null> {
    return this.inOrder(id, async () => {
      const [row] = await this.db.select().from(players).where(eq(players.id, id));
      return row ? fromRow(row) : null;
    });
  }

  save(id: PlayerId, data: PlayerSave): Promise<void> {
    return this.inOrder(id, async () => {
      const row = toRow(data);
      await this.db.insert(players).values({ id, ...row })
        .onConflictDoUpdate({ target: players.id, set: { ...row, updatedAt: sql`now()` } });
    });
  }

  async uniqueHolds(): Promise<UniqueHold[]> {
    const rows = await this.db
      .select({ item: uniqueItems.item, holder: uniqueItems.holderId, seenAt: players.updatedAt }).from(uniqueItems).innerJoin(players, eq(players.id, uniqueItems.holderId));
    return rows.map((row) => ({ item: row.item as ItemId, holder: row.holder, seenAtMs: row.seenAt.getTime() }));
  }

  holdUnique(item: ItemId, holder: PlayerId | null): Promise<void> {
    return this.inOrder(`unique:${item}`, async () => {
      if (holder === null) await this.db.delete(uniqueItems).where(eq(uniqueItems.item, item));
      else {
        await this.db.insert(uniqueItems).values({ item, holderId: holder })
          .onConflictDoUpdate({ target: uniqueItems.item, set: { holderId: holder } });
      }
    });
  }

  private inOrder<T>(id: PlayerId, query: () => Promise<T>): Promise<T> {
    // A failed earlier query doesn't stop this one: its own caller already got that error.
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
  character: data.character, bag: data.bag, equipment: data.equipment, knownWords: data.knownWords,
  skillbook: data.skillbook, story: data.story, pad: data.pad, coreSteps: data.core.steps,
  coreFill: data.core.fill, statPoints: data.core.points, inscriptions: data.core.inscriptions,
  shopsBought: data.shopsBought, faith: data.faith,
});

function fromRow(row: typeof players.$inferSelect): StoredSave {
  return {
    vitals: { hp: row.hp, stamina: row.stamina }, wins: row.wins, settings: row.settings, character: row.character,
    bag: row.bag, equipment: row.equipment, knownWords: row.knownWords, skillbook: row.skillbook, story: row.story,
    pad: row.pad, shopsBought: row.shopsBought, faith: row.faith,
    core: { steps: row.coreSteps, fill: row.coreFill, points: row.statPoints, inscriptions: row.inscriptions },
  };
}
