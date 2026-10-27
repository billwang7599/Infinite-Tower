/**
 * Accounts and login sessions. A login session is a random token in an httpOnly cookie; the store only gets its
 * SHA-256, so a leaked database can't be replayed as logins.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Account, AccountStore, PlayerId } from "../ports.js";
import { hashPassword, verifyPassword } from "./passwords.js";

export interface LoginSession {
  token: string;
  expires: Date;
}

const SESSION_DAYS = 30;

export class Accounts {
  constructor(private readonly store: AccountStore) {}

  /** null if the username is taken (case-insensitively). Doesn't check the username / password rules. */
  async create(username: string, password: string): Promise<Account | null> {
    return this.store.create(username, await hashPassword(password));
  }

  async verify(username: string, password: string): Promise<Account | null> {
    const found = await this.store.find(username);
    if (!found || !(await verifyPassword(password, found.passwordHash))) return null;
    return { id: found.id, username: found.username };
  }

  async startSession(accountId: PlayerId): Promise<LoginSession> {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await this.store.removeExpiredSessions(accountId, now);
    await this.store.addSession(hashToken(token), accountId, expires);
    return { token, expires };
  }

  /** null if the token is unknown or expired. */
  async forToken(token: string): Promise<Account | null> {
    const found = await this.store.findSession(hashToken(token));
    return found && found.expires > new Date() ? found.account : null;
  }

  async endSession(token: string): Promise<void> {
    await this.store.removeSession(hashToken(token));
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
