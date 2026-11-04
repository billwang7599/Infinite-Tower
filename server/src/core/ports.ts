/** What core needs from the outside world, as interfaces it owns; main.ts picks the implementations. */
import type {
  Bag, Character, CoreState, Equipment, Faith, ItemId, SavedSettings, ServerMsg, Skillbook, Slot, Vitals, Word,
} from "@infinite-tower/shared";
import type { ShopId } from "./content/shops.js";
import type { Story } from "./game/story.js";

/** The account's id. */
export type PlayerId = string;

export interface Account {
  id: PlayerId;
  username: string;
}

/** To keep something else across connections: add it here, to `newPlayer` (content/player.ts), and to the store. */
export interface PlayerSave {
  vitals: Vitals;
  /** Fights won. */
  wins: number;
  settings: SavedSettings;
  /** null until they've made one (their first visit). */
  character: Character | null;
  bag: Bag;
  /** The worn backpack's own grid. */
  pack: Bag;
  equipment: Equipment;
  knownWords: Word[];
  skillbook: Skillbook;
  story: Story;
  /** The region whose summoning pad they wake on, at login and after dying. */
  pad: string;
  core: CoreState;
  shopsBought: ShopId[];
  faith: Faith;
}

/** As the store has it: any older version of the game may have written it, so `keptSave` checks it before play. */
export interface StoredSave
  extends Omit<PlayerSave, "equipment" | "knownWords" | "skillbook" | "shopsBought" | "faith" | "core"> {
  equipment: Partial<Record<Slot, string | null>>;
  knownWords: readonly string[];
  skillbook: unknown;
  shopsBought: readonly string[];
  faith: unknown;
  core: { steps: unknown; fill: unknown; points: unknown; inscriptions?: unknown };
}

/** `seenAtMs`: the holder's latest save. */
export interface UniqueHold {
  item: ItemId;
  holder: PlayerId;
  seenAtMs: number;
}

export interface PlayerStore {
  /** null for a player it has never saved. */
  load(id: PlayerId): Promise<StoredSave | null>;
  /** Loads and saves for one player must land in the order they were called. */
  save(id: PlayerId, data: PlayerSave): Promise<void>;
  uniqueHolds(): Promise<UniqueHold[]>;
  /** null: nobody holds it. */
  holdUnique(item: ItemId, holder: PlayerId | null): Promise<void>;
}

export interface StoredAccount extends Account {
  /** From accounts/passwords.ts; the store keeps it as is. */
  passwordHash: string;
}

/** Accounts and their login sessions. Session tokens arrive already hashed (accounts/accounts.ts). */
export interface AccountStore {
  /** null if the username is taken. Usernames that differ only in case are the same. */
  create(username: string, passwordHash: string): Promise<Account | null>;
  /** Case-insensitive, like `create`. */
  find(username: string): Promise<StoredAccount | null>;
  addSession(tokenHash: string, accountId: PlayerId, expires: Date): Promise<void>;
  /** The session's account and when it expires, expired or not. */
  findSession(tokenHash: string): Promise<{ account: Account; expires: Date } | null>;
  removeSession(tokenHash: string): Promise<void>;
  removeExpiredSessions(accountId: PlayerId, now: Date): Promise<void>;
}

/** One connected player's line to their client. */
export interface PlayerLink {
  /** false once it's closed, from either end. */
  readonly open: boolean;
  /** Dropped if the link is closed. */
  send(msg: ServerMsg): void;
  /** `code` is a WebSocket close code: CLOSE_CODES (shared) or a standard one. */
  close(code: number, reason: string): void;
}
