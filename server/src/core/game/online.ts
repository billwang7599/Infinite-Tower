/**
 * Who's playing right now: one session per connected account. Joining loads the player's save; leaving
 * (disconnecting) saves it. An account that joins again from another tab takes over: the older link is closed
 * and saved first, so the new session loads what the old one had.
 */
import { CLOSE_CODES } from "@infinite-tower/shared";
import { newPlayer } from "../content/player.js";
import type { Account, PlayerId, PlayerLink, PlayerStore } from "../ports.js";
import { GameSession } from "./session.js";

export class OnlinePlayers {
  private readonly byAccount = new Map<PlayerId, GameSession>();

  constructor(private readonly store: PlayerStore, private readonly dev: boolean) {}

  /**
   * The player's session, once their save has loaded and `welcome` has gone out; null if the link closed while
   * loading, or loading failed (then it's closed with 1011). Until then nothing can be asked of it, which is fine:
   * the client sends nothing before `welcome`.
   */
  join(link: PlayerLink, account: Account): Promise<GameSession | null> {
    this.replace(account.id);
    return this.start(link, account).catch((err: unknown) => {
      console.error(`[store] loading ${account.username} failed`, err);
      link.close(1011, "couldn't load your save");
      return null;
    });
  }

  /** Saves once, however many times it's called (a replaced session's link also reports closing). */
  leave(session: GameSession): void {
    const id = session.account.id;
    if (this.byAccount.get(id) !== session) return;
    this.byAccount.delete(id);
    session.save();
  }

  /** One fixed step for every session (game/clock.ts). */
  tick(dt: number): void {
    for (const session of this.byAccount.values()) session.tick(dt);
  }

  private async start(link: PlayerLink, account: Account): Promise<GameSession | null> {
    const id = account.id;
    // Loads and saves for one player land in order, so this load comes after the replaced session's save.
    const saved = (await this.store.load(id)) ?? newPlayer();
    if (!link.open) return null;
    this.replace(id); // another tab may have joined while this one was loading
    const session = new GameSession(account, link, this.dev, saved, (data) => {
      this.store.save(id, data)
        .catch((err: unknown) => console.error(`[store] saving ${account.username} failed`, err));
    });
    session.start();
    // Only once it has started: a session that failed to start is never ticked or saved.
    this.byAccount.set(id, session);
    return session;
  }

  private replace(id: PlayerId): void {
    const old = this.byAccount.get(id);
    if (!old) return;
    this.leave(old);
    old.link.close(CLOSE_CODES.replaced, "playing somewhere else");
  }
}
