/**
 * Who's playing right now: one session per connected account. Joining loads the player's save; leaving
 * (disconnecting) saves it. An account that joins again from another tab takes over: the older socket is closed
 * and saved first, so the new session loads what the old one had.
 */
import { CLOSE_CODES, dispatch } from "@infinite-tower/shared";
import type { Account } from "../auth/accounts.js";
import type { Connection } from "../net/connection.js";
import type { PlayerId, PlayerStore } from "../store/player-store.js";
import { handlers } from "./handlers.js";
import { Session } from "./session.js";

export class OnlinePlayers {
  /** What the tick loop runs. */
  readonly sessions = new Set<Session>();
  private readonly byAccount = new Map<PlayerId, Session>();

  constructor(private readonly store: PlayerStore, private readonly dev: boolean) {}

  join(conn: Connection, account: Account): void {
    this.replace(account.id);
    this.start(conn, account).catch((err: unknown) => {
      console.error(`[store] loading ${account.username} failed`, err);
      conn.close(1011, "couldn't load your save");
    });
  }

  /** Messages that arrive while the save loads are dropped; the client sends nothing before `welcome` anyway. */
  private async start(conn: Connection, account: Account): Promise<void> {
    const id = account.id;
    // The store runs one player's queries in order, so this load comes after the replaced session's save.
    const saved = await this.store.load(id);
    if (!conn.open) return;
    this.replace(id); // another tab may have joined while this one was loading
    const session = new Session(conn, this.dev, saved, (data) => {
      this.store.save(id, data).catch((err: unknown) => console.error(`[store] saving ${account.username} failed`, err));
    });
    this.sessions.add(session);
    this.byAccount.set(id, session);
    conn.onMessage((msg) => dispatch(handlers, msg, session));
    conn.onClose(() => this.leave(id, session));
    session.start();
  }

  private replace(id: PlayerId): void {
    const old = this.byAccount.get(id);
    if (!old) return;
    this.leave(id, old);
    old.conn.close(CLOSE_CODES.replaced, "playing somewhere else");
  }

  /** Saves once, however many times it's called (a replaced session also gets its socket's close event). */
  private leave(id: PlayerId, session: Session): void {
    if (!this.sessions.delete(session)) return;
    if (this.byAccount.get(id) === session) this.byAccount.delete(id);
    session.save();
  }
}
