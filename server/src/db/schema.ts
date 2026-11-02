/** The tables. After changing one, run `npm run db:generate -- --name <what-changed>` and commit the migration. */
import {
  blankSkillbook, emptyEquipment, type Bag, type Character, type Equipment, type SavedSettings, type Skillbook,
  type StatPoints,
} from "@infinite-tower/shared";
import { sql } from "drizzle-orm";
import { newStory, type Story } from "../core/game/story.js";
import { START_LEVEL } from "../core/world/index.js";
import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** Logins (account-store.ts). The password is scrypt'd, with its parameters and salt (core/accounts/passwords.ts). */
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

/** What carries over between a player's connections (player-store.ts). A player is an account. */
export const players = pgTable("players", {
  id: uuid().primaryKey().references(() => accounts.id, { onDelete: "cascade" }),
  hp: doublePrecision().notNull(),
  stamina: doublePrecision().notNull(),
  /** Fights won (any enemy), shown on the overworld HUD. */
  wins: integer().notNull().default(0),
  /** Only what differs from the defaults, so {} is "all defaults". */
  settings: jsonb().$type<SavedSettings>().notNull().default({}),
  /** null until they've made one, on their first visit. */
  character: jsonb().$type<Character>(),
  /** Named "inventory" in the database. */
  bag: jsonb("inventory").$type<Bag>().notNull(),
  equipment: jsonb().$type<Equipment>().notNull().default(emptyEquipment()),
  knownWords: text("known_words").array().notNull().default([]),
  skillbook: jsonb().$type<Skillbook>().notNull().default(blankSkillbook()),
  story: jsonb().$type<Story>().notNull().default(newStory()),
  pad: text().notNull().default(START_LEVEL),
  coreSteps: integer("core_steps").notNull().default(0),
  coreFill: integer("core_fill").notNull().default(0),
  statPoints: jsonb("stat_points").$type<StatPoints>().notNull().default({}),
  inscriptions: text().array().notNull().default([]),
  shopsBought: text("shops_bought").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uniqueItems = pgTable("unique_items", {
  item: text().primaryKey(),
  holderId: uuid("holder_id").notNull().references(() => players.id, { onDelete: "cascade" }),
});
