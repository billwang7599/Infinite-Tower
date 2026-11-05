/**
 * Who's playing: one session per account, loaded on join and saved on leave. Joining from another tab takes over:
 * the old session is saved first, so the new one loads what it had.
 */
import { carriedCounts, CLOSE_CODES, sigilOf, type ClientMsg, type ItemId } from "@infinite-tower/shared";
import { keptSave, newPlayer } from "../content/player.js";
import { Pile } from "../overworld/components.js";
import { Overworld } from "../overworld/overworld.js";
import { WORLD } from "../world/index.js";
import type { Account, PlayerId, PlayerLink, PlayerStore } from "../ports.js";
import { Chat } from "./chat.js";
import { Duels } from "./duels.js";
import { GameSession, type Others } from "./session.js";
import { Uniques } from "./uniques.js";

export const IDLE_KICK_MS = 15 * 60 * 1000;

// The client sends these on its own timer, idle or not.
const playerDriven = (msg: ClientMsg) =>
  msg.t === "battleInput" ? msg.inputs.length > 0 : msg.t !== "battleResync" && msg.t !== "ping";

export class OnlinePlayers {
  private readonly byAccount = new Map<PlayerId, GameSession>();
  private readonly activeAtMs = new WeakMap<GameSession, number>();
  private world: Overworld | null = null;
  private readonly online = () => this.byAccount.values();
  readonly uniques: Uniques;
  private readonly others: Others;

  constructor(private readonly store: PlayerStore, private readonly cheats: boolean, readonly maxPlayers: number) {
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

  heard(session: GameSession, msg: ClientMsg): void {
    if (playerDriven(msg)) this.activeAtMs.set(session, Date.now());
  }

  tick(dt: number): void {
    if (this.world && !this.world.empty) this.world.step(dt);
    for (const session of this.byAccount.values()) session.tick();
    this.others.duels.tick();
    this.kickIdle();
  }

  private kickIdle(): void {
    const nowMs = Date.now();
    const idle = [...this.byAccount.values()].filter((s) => nowMs - (this.activeAtMs.get(s) ?? nowMs) >= IDLE_KICK_MS);
    for (const session of idle) {
      this.leave(session);
      session.link.close(CLOSE_CODES.idle, "idle too long");
    }
  }

  private async start(link: PlayerLink, account: Account): Promise<GameSession | null> {
    const id = account.id;
    // Loads and saves for one player land in order, so this load comes after the replaced session's save.
    const stored = await this.store.load(id);
    const { save: loaded, spilled } = stored ? keptSave(stored) : { save: newPlayer(), spilled: {} };
    await this.uniques.ready;
    if (!link.open || this.refusedAsFull(link, id)) return null;
    this.replace(id); // another tab may have joined while this one was loading
    const saved = this.uniques.kept(id, loaded);
    const session = new GameSession(account, link, this.cheats, saved, (data) => {
      this.uniques.saved(id, data);
      this.store.save(id, data)
        .catch((err: unknown) => console.error(`[store] saving ${account.username} failed`, err));
    }, () => this.overworld, this.others);
    session.start();
    if (session.inWorld && Object.keys(spilled).length > 0) {
      session.overworld.dropPile(session.overworld.playerPos(session.me), spilled);
      session.save(); // at once, so a crash can't spill the old bag twice
    }
    // Only once it has started: a session that failed to start is never ticked or saved.
    this.byAccount.set(id, session);
    this.activeAtMs.set(session, Date.now());
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
