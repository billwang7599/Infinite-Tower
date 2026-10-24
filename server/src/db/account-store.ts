import { and, eq, lt, sql } from "drizzle-orm";
import type { AccountStore } from "../core/ports.js";
import type { Db } from "./db.js";
import { accounts, sessions } from "./schema.js";

const ACCOUNT = { id: accounts.id, username: accounts.username };

/** Accounts in Postgres: the `accounts` and `sessions` tables (schema.ts). */
export class PgAccountStore implements AccountStore {
  constructor(private readonly db: Db) {}

  async create(username: string, passwordHash: string) {
    const [row] = await this.db.insert(accounts)
      .values({ username, passwordHash })
      .onConflictDoNothing() // the only conflict that can happen is the username (accounts_username_key)
      .returning(ACCOUNT);
    return row ?? null;
  }

  async find(username: string) {
    const [row] = await this.db.select({ ...ACCOUNT, passwordHash: accounts.passwordHash })
      .from(accounts).where(sameUsername(username));
    return row ?? null;
  }

  async addSession(tokenHash: string, accountId: string, expires: Date) {
    await this.db.insert(sessions).values({ tokenHash, accountId, expiresAt: expires });
  }

  async findSession(tokenHash: string) {
    const [row] = await this.db.select({ account: ACCOUNT, expires: sessions.expiresAt })
      .from(sessions).innerJoin(accounts, eq(accounts.id, sessions.accountId))
      .where(eq(sessions.tokenHash, tokenHash));
    return row ?? null;
  }

  async removeSession(tokenHash: string) {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async removeExpiredSessions(accountId: string, now: Date) {
    await this.db.delete(sessions).where(and(eq(sessions.accountId, accountId), lt(sessions.expiresAt, now)));
  }
}

/** Matches the unique index on lower(username), so it can use it. */
const sameUsername = (username: string) => sql`lower(${accounts.username}) = lower(${username})`;
