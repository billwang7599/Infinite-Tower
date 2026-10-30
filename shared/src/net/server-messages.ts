/** Server -> client messages: plain types, as the server is trusted. ARCHITECTURE.md's "Networking" has the flow. */
import type { Vec2 } from "../core/math.js";
import type { Vitals } from "../battle/player.js";
import type { EnemyId } from "../battle/defs.js";
import type { StepInput } from "../battle/input.js";
import type { FightSetup, PlayerSetup } from "../battle/fight/setup.js";
import type { FightSnapshot } from "../battle/fight/state.js";
import type { Stats } from "../battle/stats.js";
import type { Character } from "../character/character.js";
import type { Gear, UseSpot } from "../items/gear.js";
import type { ItemCounts, ItemId } from "../items/items.js";
import type { LevelLayout, NpcId } from "../world/layout.js";
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

export interface PileSnap {
  id: number;
  x: number;
  z: number;
}

/** `from`: the speaker's character name, stamped by the server. */
export interface ChatLine {
  from: string;
  text: string;
}

/** After trimming. */
export const MAX_CHAT_CHARS = 500;

/** `busy`: `who` (null: you) is in another challenge already. */
export type ChallengeNews =
  | { kind: "sent"; to: string }
  | { kind: "received"; from: string }
  | { kind: "declined"; by: string }
  | { kind: "expired"; with: string }
  | { kind: "cancelled"; with: string }
  | { kind: "nobodyNear" }
  | { kind: "busy"; who: string | null };

export type QuestHalf = "main" | "side";

export type Tally = { item: ItemId; need: number } | { kills: number; need: number };

export interface LoreEntry {
  title: string;
  text: string;
}

export interface QuestView {
  id: string;
  title: string;
  half: QuestHalf;
  step: { text: string; hint: string; tally: Tally | null } | null;
  lore: LoreEntry[];
}

export type QuestNews =
  | { kind: "taken"; quest: string; step: string }
  | { kind: "tally"; quest: string; have: number; need: number }
  | {
    kind: "advanced"; quest: string; next: string | null; gained: ItemCounts; dropped: ItemCounts; lore: string[];
  };

export type DialogueOffer =
  | { kind: "quest"; quest: string; title: string; step: string }
  | { kind: "deliver"; quest: string; item: ItemId; count: number };

export type ServerMsg =
  /** `character` is null until the player has made one; the level comes only after that. `chat`: the last lines
   * said, oldest first. */
  | {
    t: "welcome"; wins: number; vitals: Vitals; stats: Stats; settings: SavedSettings; character: Character | null;
    gear: Gear; knownWords: Word[]; skillbook: Skillbook; chat: ChatLine[]; questbook: QuestView[]; dev: boolean;
  }
  | { t: "character"; character: Character }
  | { t: "level"; level: LevelLayout; me: Vec2 }
  /** 20 times a second, so only what moves. */
  | { t: "state"; ack: number; me: Vec2; actors: ActorSnap[]; players: PlayerSnap[]; piles: PileSnap[] }
  /** `source`: the actor that touched you, or null for tall grass. You're `setup.players[seat]`. */
  | {
    t: "encounter"; source: number | null; me: Vec2; seat: number; setup: FightSetup;
    joined?: { host: string; step: number; fight: FightSnapshot };
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
  /** A line said anywhere on the server. `speaker`: you, their id among `state`'s players if they're on your level
   * (whether or not in view), or null. */
  | { t: "chat"; line: ChatLine; speaker: number | "you" | null }
  | { t: "chatRefused"; reason: "tooFast" | "tooLong" }
  | { t: "joinRefused"; reason: "nobodyNear" | "full" | "duel" }
  /** Using what's at `at` has started (its `useTime`, then `itemUsed`), or null: it stopped, nothing used. */
  | { t: "using"; at: UseSpot | null }
  | { t: "itemUsed"; item: ItemId; vitals: Vitals; gear: Gear }
  | { t: "gear"; gear: Gear }
  | { t: "rested"; vitals: Vitals }
  | { t: "dialogue"; npc: NpcId; lines: readonly string[]; offer: DialogueOffer | null }
  | { t: "questbook"; quests: QuestView[]; news: QuestNews[] }
  /** Dev cheats' answers. `given`: `count` of `item` packed into the bag, `left` that didn't fit. */
  | { t: "healed"; vitals: Vitals }
  | { t: "given"; item: ItemId; count: number; left: number; gear: Gear }
  | { t: "invulnerable"; on: boolean }
  | { t: "skillbook"; skillbook: Skillbook }
  /** Sent while you're still in the arena. `lost`: what a death dropped. `afterFightMs`: how long the arena
   * stays open for its drops after a win, or null if it's over for you. `duel`: the opponent's name, after a duel. */
  | {
    t: "battleResult"; won: boolean; me: Vec2; wins: number; vitals: Vitals; lost: ItemCounts; gear: Gear;
    skillbook: Skillbook; afterFightMs: number | null; duel?: string;
  }
  /** After a win, the drops lying in the arena (metres), each time they change. */
  | { t: "arenaDrops"; piles: PileSnap[] }
  /** The arena's time after a win ran out: you're back on the overworld. */
  | { t: "arenaClosed" }
  | { t: "pong"; id: number };

/** `ServerMsgOf<"state">`. */
export type ServerMsgOf<T extends ServerMsg["t"]> = MsgOf<ServerMsg, T>;

/** Why the server closed the socket, besides the standard codes. */
export const CLOSE_CODES = {
  /** The same account joined from another tab or browser; the newer one plays. */
  replaced: 4000,
  /** No (or an expired) login cookie. */
  notLoggedIn: 4001,
  full: 4002,
  /** Loading the player's save failed (WebSocket's "internal error"). */
  loadFailed: 1011,
} as const;
