/**
 * In-memory stand-ins for core's ports (core/ports.ts), so core can be tested without a database or a socket.
 */
import type { ItemId, ServerMsg, ServerMsgOf } from "@infinite-tower/shared";
import type {
  Account, AccountStore, PlayerId, PlayerLink, PlayerSave, PlayerStore, StoredAccount, UniqueHold,
} from "../../src/core/ports.js";

/** A player's line to their client that records what was sent, and how it was closed. */
export class FakeLink implements PlayerLink {
  open = true;
  readonly sent: ServerMsg[] = [];
  closed: { code: number; reason: string } | null = null;

  send(msg: ServerMsg): void {
    if (this.open) this.sent.push(msg);
  }

  close(code: number, reason: string): void {
    if (!this.open) return;
    this.open = false;
    this.closed = { code, reason };
  }

  /** Every message sent of kind `t`, oldest first. */
  all<T extends ServerMsg["t"]>(t: T): ServerMsgOf<T>[] {
    return this.sent.filter((m): m is ServerMsgOf<T> => m.t === t);
  }

  /** The newest message of kind `t`; throws if there's none. */
  last<T extends ServerMsg["t"]>(t: T): ServerMsgOf<T> {
    const found = this.all(t).at(-1);
    if (!found) throw new Error(`no "${t}" message was sent (sent: ${this.sent.map((m) => m.t).join(", ")})`);
    return found;
  }
}

/** Saves kept in a Map. Set `failLoad` to make loads reject; `hold()` to keep the next load pending. */
export class MemoryPlayerStore implements PlayerStore {
  readonly saved = new Map<PlayerId, PlayerSave>();
  /** Every save, in order. */
  readonly saves: { id: PlayerId; data: PlayerSave }[] = [];
  readonly holds = new Map<ItemId, PlayerId>();
  private readonly savedAtMs = new Map<PlayerId, number>();
  failLoad: Error | null = null;
  private held: (() => void) | null = null;

  async load(id: PlayerId): Promise<PlayerSave | null> {
    if (this.held) await new Promise<void>((resolve) => { this.held = resolve; });
    if (this.failLoad) throw this.failLoad;
    const data = this.saved.get(id);
    return data ? structuredClone(data) : null;
  }

  async save(id: PlayerId, data: PlayerSave): Promise<void> {
    this.saves.push({ id, data: structuredClone(data) });
    this.saved.set(id, structuredClone(data));
    this.savedAtMs.set(id, Date.now());
  }

  async uniqueHolds(): Promise<UniqueHold[]> {
    return [...this.holds].map(([item, holder]) => ({ item, holder, seenAtMs: this.savedAtMs.get(holder) ?? 0 }));
  }

  async holdUnique(item: ItemId, holder: PlayerId | null): Promise<void> {
    if (holder === null) this.holds.delete(item);
    else this.holds.set(item, holder);
  }

  /** The next load waits until the returned function is called. */
  hold(): () => void {
    this.held = () => {};
    return () => { const release = this.held; this.held = null; release?.(); };
  }
}

/** Accounts and login sessions in Maps, case-insensitive like the real one. Set `fail` to make every call reject. */
export class MemoryAccountStore implements AccountStore {
  readonly accounts = new Map<string, StoredAccount>();
  readonly sessions = new Map<string, { accountId: PlayerId; expires: Date }>();
  fail: Error | null = null;
  private nextId = 1;

  async create(username: string, passwordHash: string): Promise<Account | null> {
    this.check();
    const key = username.toLowerCase();
    if (this.accounts.has(key)) return null;
    const account = { id: `account-${this.nextId++}`, username };
    this.accounts.set(key, { ...account, passwordHash });
    return account;
  }

  async find(username: string): Promise<StoredAccount | null> {
    this.check();
    return this.accounts.get(username.toLowerCase()) ?? null;
  }

  async addSession(tokenHash: string, accountId: PlayerId, expires: Date): Promise<void> {
    this.check();
    this.sessions.set(tokenHash, { accountId, expires });
  }

  async findSession(tokenHash: string): Promise<{ account: Account; expires: Date } | null> {
    this.check();
    const session = this.sessions.get(tokenHash);
    const found = session && [...this.accounts.values()].find((a) => a.id === session.accountId);
    return session && found ? { account: { id: found.id, username: found.username }, expires: session.expires } : null;
  }

  async removeSession(tokenHash: string): Promise<void> {
    this.check();
    this.sessions.delete(tokenHash);
  }

  async removeExpiredSessions(accountId: PlayerId, now: Date): Promise<void> {
    this.check();
    for (const [hash, s] of this.sessions) {
      if (s.accountId === accountId && s.expires <= now) this.sessions.delete(hash);
    }
  }

  private check(): void {
    if (this.fail) throw this.fail;
  }
}
