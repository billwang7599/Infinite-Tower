/** Server -> client messages: plain types, as the server is trusted. ARCHITECTURE.md's "Networking" has the flow. */
import type { Vec2 } from "../core/math.js";
import type { Vitals } from "../battle/player.js";
import type { EnemyId } from "../battle/defs.js";
import type { StepInput } from "../battle/input.js";
import type { FightSetup, PlayerSetup } from "../battle/fight/setup.js";
import type { FightSnapshot } from "../battle/fight/state.js";
import type { Stats } from "../battle/stats.js";
import type { Character } from "../character/character.js";
import type { Gear } from "../items/gear.js";
import type { ItemCounts, ItemId } from "../items/items.js";
import type { LevelLayout } from "../world/layout.js";
import type { Skillbook, Word } from "../skills/skill.js";
import type { SavedSettings } from "./client-messages.js";
import type { MsgOf } from "./handlers.js";

/** An overworld actor to draw. */
export interface ActorSnap {
  id: number;
  kind: EnemyId;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: 1 | -1;
  /** Noticed you: "!". */
  alert: boolean;
}

/** Another player on the overworld. `character` comes only the first time they're sent to you. */
export interface PlayerSnap {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  fighting: boolean;
  character?: Character;
}

/** `busy`: `who` (null: you) is in another challenge already. */
export type ChallengeNews =
  | { kind: "sent"; to: string }
  | { kind: "received"; from: string }
  | { kind: "declined"; by: string }
  | { kind: "expired"; with: string }
  | { kind: "cancelled"; with: string }
  | { kind: "nobodyNear" }
  | { kind: "busy"; who: string | null };

export type ServerMsg =
  /** `character` is null until the player has made one; the level comes only after that. */
  | {
    t: "welcome"; wins: number; vitals: Vitals; stats: Stats; settings: SavedSettings; character: Character | null;
    gear: Gear; knownWords: Word[]; skillbook: Skillbook; dev: boolean;
  }
  | { t: "character"; character: Character }
  | { t: "level"; level: LevelLayout; me: Vec2 }
  /** 20 times a second, so only what moves. */
  | { t: "state"; ack: number; me: Vec2; actors: ActorSnap[]; players: PlayerSnap[] }
  /** `source`: the actor that touched you, or null for tall grass. You're `setup.players[seat]`. */
  | {
    t: "encounter"; source: number | null; me: Vec2; seat: number; setup: FightSetup;
    opponent?: { name: string; character: Character }; joined?: { host: string; step: number; fight: FightSnapshot };
  }
  /** `lateSteps`: how late your inputs reach the server (the best since the last hash; negative: early), measured
   * on your input up to `heardStep` (client/src/modes/battle/pace.ts). */
  | { t: "battleHash"; step: number; hash: number; lateSteps: number; heardStep: number }
  /** The answer to `battleResync`, and once more as the fight is decided. */
  | { t: "battleSync"; step: number; fight: FightSnapshot; lateSteps: number; heardStep: number }
  /** Another player came in; a `battleSync` with them in it follows. */
  | { t: "battleJoined"; player: PlayerSetup }
  /** The other players' changes of input, as the server ran them, since the last of these. */
  | { t: "battleInputs"; inputs: { seat: number; changes: StepInput[] }[] }
  | { t: "challengeNews"; news: ChallengeNews }
  | { t: "joinRefused"; reason: "nobodyNear" | "full" | "duel" }
  | { t: "itemUsed"; item: ItemId; vitals: Vitals; gear: Gear }
  | { t: "gear"; gear: Gear }
  | { t: "rested"; vitals: Vitals }
  /** Dev cheats' answers. `given`: `count` of `item` packed into the bag, `left` that didn't fit. */
  | { t: "healed"; vitals: Vitals }
  | { t: "given"; item: ItemId; count: number; left: number; gear: Gear }
  | { t: "invulnerable"; on: boolean }
  | { t: "skillbook"; skillbook: Skillbook }
  /** Sent while you're still in the arena. `lost`: what the bag held, on a loss. `loot` is packed into the bag but
   * `leftBehind`. `duel`: the opponent's name, after a duel. */
  | {
    t: "battleResult"; won: boolean; me: Vec2; wins: number; vitals: Vitals; loot: ItemCounts; leftBehind: ItemCounts;
    lost: ItemCounts; gear: Gear; skillbook: Skillbook; duel?: string;
  }
  | { t: "pong"; id: number };

/** `ServerMsgOf<"state">`. */
export type ServerMsgOf<T extends ServerMsg["t"]> = MsgOf<ServerMsg, T>;

/** Why the server closed the socket, besides the standard codes. */
export const CLOSE_CODES = {
  /** The same account joined from another tab or browser; the newer one plays. */
  replaced: 4000,
  /** No (or an expired) login cookie. */
  notLoggedIn: 4001,
  /** MAX_PLAYERS are already on. */
  full: 4002,
  /** Loading the player's save failed (WebSocket's "internal error"). */
  loadFailed: 1011,
} as const;
