/**
 * Accounts and login sessions in Postgres (the `accounts` and `sessions` tables, db/schema.ts). A login session is
 * a random token the browser keeps in an httpOnly cookie (cookies.ts); the table only has the token's SHA-256, so
 * a leaked database can't be replayed as logins.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Db } from "../db/db.js";
import { accounts, sessions } from "../db/schema.js";
import { hashPassword, verifyPassword } from "./passwords.js";

export interface Account {
  id: string;
  username: string;
}

export interface LoginSession {
  token: string;
  expires: Date;
}

const SESSION_DAYS = 30;
const ACCOUNT = { id: accounts.id, username: accounts.username };

export class Accounts {
  constructor(private readonly db: Db) {}

  /** null if the username is taken (case-insensitively). Doesn't check the username / password rules. */
  async create(username: string, password: string): Promise<Account | null> {
    const [row] = await this.db.insert(accounts)
      .values({ username, passwordHash: await hashPassword(password) })
      .onConflictDoNothing() // the only conflict that can happen is the username (accounts_username_key)
      .returning(ACCOUNT);
    return row ?? null;
  }

  /** The account, if the username exists and the password matches. */
  async verify(username: string, password: string): Promise<Account | null> {
    const [row] = await this.db.select({ ...ACCOUNT, passwordHash: accounts.passwordHash })
      .from(accounts).where(sameUsername(username));
    if (!row || !(await verifyPassword(password, row.passwordHash))) return null;
    return { id: row.id, username: row.username };
  }

  async startSession(accountId: string): Promise<LoginSession> {
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await this.db.delete(sessions).where(and(eq(sessions.accountId, accountId), lt(sessions.expiresAt, sql`now()`)));
    await this.db.insert(sessions).values({ tokenHash: hashToken(token), accountId, expiresAt: expires });
    return { token, expires };
  }

  /** The logged-in account for a cookie's token, or null if it's unknown or expired. */
  async forToken(token: string): Promise<Account | null> {
    const [row] = await this.db.select(ACCOUNT)
      .from(sessions).innerJoin(accounts, eq(accounts.id, sessions.accountId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, sql`now()`)));
    return row ?? null;
  }

  async endSession(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
}

/** Matches the unique index on lower(username), so it can use it. */
const sameUsername = (username: string) => sql`lower(${accounts.username}) = lower(${username})`;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
