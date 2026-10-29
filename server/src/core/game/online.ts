/**
 * Who's playing: one session per account, loaded on join and saved on leave, and the levels' overworlds they share.
 * Joining from another tab takes over: the old session is saved first, so the new one loads what it had. Past
 * `maxPlayers`, a new player is refused.
 */
import { CLOSE_CODES } from "@infinite-tower/shared";
import { newPlayer } from "../content/player.js";
import { Overworld } from "../overworld/overworld.js";
import { getLevel } from "../world/index.js";
import type { Account, PlayerId, PlayerLink, PlayerStore } from "../ports.js";
import { Duels } from "./duels.js";
import { GameSession } from "./session.js";

export class OnlinePlayers {
  private readonly byAccount = new Map<PlayerId, GameSession>();
  private readonly overworlds = new Map<string, Overworld>();
  private readonly duels = new Duels(() => this.byAccount.values());

  constructor(private readonly store: PlayerStore, private readonly dev: boolean, readonly maxPlayers: number) {}

  get count(): number {
    return this.byAccount.size;
  }

  /** null if the link closed while loading, the server is full, or loading failed (then it's closed with 1011). */
  join(link: PlayerLink, account: Account): Promise<GameSession | null> {
    if (this.refusedAsFull(link, account.id)) return Promise.resolve(null);
    this.replace(account.id);
    return this.start(link, account).catch((err: unknown) => {
      console.error(`[store] loading ${account.username} failed`, err);
      link.close(CLOSE_CODES.loadFailed, "couldn't load your save");
      return null;
    });
  }

  /** Once, however many times it's called (a replaced session's link also reports closing). */
  leave(session: GameSession): void {
    if (!this.isOn(session)) return;
    this.byAccount.delete(session.account.id);
    session.disconnect();
  }

  /** False once it has left or been taken over: its socket may still deliver messages, which must be dropped. */
  isOn(session: GameSession): boolean {
    return this.byAccount.get(session.account.id) === session;
  }

  tick(dt: number): void {
    for (const overworld of this.overworlds.values()) if (!overworld.empty) overworld.step(dt);
    for (const session of this.byAccount.values()) session.tick();
    this.duels.tick();
  }

  private async start(link: PlayerLink, account: Account): Promise<GameSession | null> {
    const id = account.id;
    // Loads and saves for one player land in order, so this load comes after the replaced session's save.
    const saved = (await this.store.load(id)) ?? newPlayer();
    if (!link.open || this.refusedAsFull(link, id)) return null;
    this.replace(id); // another tab may have joined while this one was loading
    const session = new GameSession(account, link, this.dev, saved, (data) => {
      this.store.save(id, data)
        .catch((err: unknown) => console.error(`[store] saving ${account.username} failed`, err));
    }, (levelId) => this.overworldOf(levelId), this.duels);
    session.start();
    // Only once it has started: a session that failed to start is never ticked or saved.
    this.byAccount.set(id, session);
    return session;
  }

  private overworldOf(levelId: string): Overworld {
    let overworld = this.overworlds.get(levelId);
    if (!overworld) this.overworlds.set(levelId, overworld = new Overworld(getLevel(levelId)));
    return overworld;
  }

  /** A player already on (in another tab) is never refused: they'd only take their own place. */
  private refusedAsFull(link: PlayerLink, id: PlayerId): boolean {
    if (this.byAccount.has(id) || this.byAccount.size < this.maxPlayers) return false;
    link.close(CLOSE_CODES.full, "server full");
    return true;
  }

  private replace(id: PlayerId): void {
    const old = this.byAccount.get(id);
    if (!old) return;
    this.leave(old);
    old.link.close(CLOSE_CODES.replaced, "playing somewhere else");
  }
}
