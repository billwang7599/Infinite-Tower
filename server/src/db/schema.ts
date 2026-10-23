/**
 * The database's tables, in TypeScript. Queries are typed from these. After changing a table, run
 * `npm run db:generate -- --name <what-changed>` to write the migration into migrations/, and commit both.
 */
import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** What carries over between a player's connections (store/pg-player-store.ts). Everyone is 'guest' for now. */
export const players = pgTable("players", {
  id: text().primaryKey(),
  hp: doublePrecision().notNull(),
  stamina: doublePrecision().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
