/**
 * Who's playing: one session per account, loaded on join and saved on leave. Joining from another tab takes over:
 * the old session is saved first, so the new one loads what it had.
 */
import { carriedCounts, CLOSE_CODES, sigilOf, type ItemId } from "@infinite-tower/shared";
import { keptSave, newPlayer } from "../content/player.js";
import { Pile } from "../overworld/components.js";
import { Overworld } from "../overworld/overworld.js";
import { WORLD } from "../world/index.js";
import type { Account, PlayerId, PlayerLink, PlayerStore } from "../ports.js";
import { Chat } from "./chat.js";
import { Duels } from "./duels.js";
import { GameSession, type Others } from "./session.js";
import { Uniques } from "./uniques.js";

export class OnlinePlayers {
  private readonly byAccount = new Map<PlayerId, GameSession>();
  private world: Overworld | null = null;
  private readonly online = () => this.byAccount.values();
  readonly uniques: Uniques;
  private readonly others: Others;

  constructor(private readonly store: PlayerStore, private readonly dev: boolean, readonly maxPlayers: number) {
    this.uniques = new Uniques(store, () => this.inPlay());
    this.others = {
      online: this.online, duels: new Duels(this.online), chat: new Chat(this.online), uniques: this.uniques,
    };
  }

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
    if (this.world && !this.world.empty) this.world.step(dt);
    for (const session of this.byAccount.values()) session.tick();
    this.others.duels.tick();
  }

  private async start(link: PlayerLink, account: Account): Promise<GameSession | null> {
    const id = account.id;
    // Loads and saves for one player land in order, so this load comes after the replaced session's save.
    const stored = await this.store.load(id), loaded = stored ? keptSave(stored) : newPlayer();
    await this.uniques.ready;
    if (!link.open || this.refusedAsFull(link, id)) return null;
    this.replace(id); // another tab may have joined while this one was loading
    const saved = this.uniques.kept(id, loaded);
    const session = new GameSession(account, link, this.dev, saved, (data) => {
      this.uniques.saved(id, data);
      this.store.save(id, data)
        .catch((err: unknown) => console.error(`[store] saving ${account.username} failed`, err));
    }, () => this.overworld, this.others);
    session.start();
    // Only once it has started: a session that failed to start is never ticked or saved.
    this.byAccount.set(id, session);
    return session;
  }

  private get overworld(): Overworld {
    return this.world ??= new Overworld(WORLD);
  }

  /** A player already on (in another tab) is never refused: they'd only take their own place. */
  private refusedAsFull(link: PlayerLink, id: PlayerId): boolean {
    if (this.byAccount.has(id) || this.byAccount.size < this.maxPlayers) return false;
    link.close(CLOSE_CODES.full, "server full");
    return true;
  }

  private *inPlay(): Iterable<ItemId> {
    for (const [, pile] of this.world?.world.query(Pile) ?? []) for (const stack of pile.items.items) yield stack.item;
    for (const session of this.byAccount.values()) {
      yield* Object.keys(carriedCounts(session.gear)) as ItemId[];
      for (const id of session.core.inscriptions) yield sigilOf(id);
    }
  }

  private replace(id: PlayerId): void {
    const old = this.byAccount.get(id);
    if (!old) return;
    this.leave(old);
    old.link.close(CLOSE_CODES.replaced, "playing somewhere else");
  }
}
