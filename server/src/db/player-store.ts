import {
  blankSkillbook, fitsSlot, ITEMS, keptCore, keptFaith, SLOTS, validateSkill, WORDS, type Equipment, type ItemId,
  type Slot, type Skill, type Skillbook, type Word,
} from "@infinite-tower/shared";
import { SkillSchema } from "@infinite-tower/shared/net/client-messages";
import { eq, sql } from "drizzle-orm";
import { SHOPS, type ShopId } from "../core/content/shops.js";
import { keptStory } from "../core/game/story.js";
import type { PlayerId, PlayerSave, PlayerStore, UniqueHold } from "../core/ports.js";
import type { Db } from "./db.js";
import { players, uniqueItems } from "./schema.js";

/** Players in Postgres: the `players` table (schema.ts). */
export class PgPlayerStore implements PlayerStore {
  /** Each player's latest query: one player's loads and saves run in order, so an older save can't land last. */
  private readonly last = new Map<PlayerId, Promise<unknown>>();

  constructor(private readonly db: Db) {}

  load(id: PlayerId): Promise<PlayerSave | null> {
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
    return rows.filter((row) => Object.hasOwn(ITEMS, row.item))
      .map((row) => ({ item: row.item as ItemId, holder: row.holder, seenAtMs: row.seenAt.getTime() }));
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

function fromRow(row: typeof players.$inferSelect): PlayerSave {
  const knownWords = row.knownWords.filter((word): word is Word => (WORDS as readonly string[]).includes(word));
  return {
    vitals: { hp: row.hp, stamina: row.stamina }, wins: row.wins, settings: row.settings,
    character: row.character, bag: row.bag, equipment: wearable(row.equipment), knownWords,
    skillbook: readable(row.skillbook, new Set(knownWords)), story: keptStory(row.story), pad: row.pad,
    core: keptCore({
      steps: row.coreSteps, fill: row.coreFill, points: row.statPoints, inscriptions: row.inscriptions,
    }),
    shopsBought: row.shopsBought.filter((shop): shop is ShopId => Object.hasOwn(SHOPS, shop)),
    faith: keptFaith(row.faith),
  };
}

function readable(saved: unknown, known: ReadonlySet<Word>): Skillbook {
  const pages: readonly unknown[] = Array.isArray(saved) ? saved : [];
  return blankSkillbook().map((_, i) => {
    const page = SkillSchema.safeParse(pages[i]);
    return page.success && validateSkill(page.data, known).length === 0 ? page.data as Skill : null;
  });
}

function wearable(saved: Partial<Record<Slot, string | null>>): Equipment {
  const keep = (slot: Slot) => {
    const item = saved[slot];
    return item && Object.hasOwn(ITEMS, item) && fitsSlot(item as ItemId, slot) ? item as ItemId : null;
  };
  return Object.fromEntries(SLOTS.map((slot) => [slot, keep(slot)])) as Equipment;
}
