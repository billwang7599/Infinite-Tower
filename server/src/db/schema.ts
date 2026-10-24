/**
 * The database's tables, in TypeScript. Queries are typed from these. After changing a table, run
 * `npm run db:generate -- --name <what-changed>` to write the migration into migrations/, and commit both.
 */
import type { Character, Inventory, SavedSettings } from "@infinite-tower/shared";
import { sql } from "drizzle-orm";
import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** Logins (auth/accounts.ts). The password is scrypt'd, with its parameters and salt (auth/passwords.ts). */
export const accounts = pgTable("accounts", {
  id: uuid().primaryKey().defaultRandom(),
  username: text().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // "Test" and "test" are the same account.
  uniqueIndex("accounts_username_key").on(sql`lower(${t.username})`),
]);

/** Login sessions. The browser keeps the token in an httpOnly cookie; only its SHA-256 is stored here. */
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("sessions_account_id_idx").on(t.accountId)]);

/** What carries over between a player's connections (store/pg-player-store.ts). A player is an account. */
export const players = pgTable("players", {
  id: uuid().primaryKey().references(() => accounts.id, { onDelete: "cascade" }),
  hp: doublePrecision().notNull(),
  stamina: doublePrecision().notNull(),
  /** Fights won (any enemy), shown on the field HUD. */
  wins: integer().notNull().default(0),
  /** Key bindings and camera: only what differs from the defaults, so {} is "all defaults". */
  settings: jsonb().$type<SavedSettings>().notNull().default({}),
  /** {name, look} (shared/src/character/character.ts). null until they've made one, on their first visit. */
  character: jsonb().$type<Character>(),
  /** What they carry: item id -> count (shared/src/items/items.ts). {} is empty-handed. */
  inventory: jsonb().$type<Inventory>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
