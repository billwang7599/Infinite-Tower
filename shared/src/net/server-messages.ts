/**
 * Server -> client messages. The server is trusted, so these are plain types (no runtime checks).
 *
 * Flow: `welcome` once, then `level` whenever you enter a level (also right after welcome). In the
 * overworld the client sends one `input` per fixed tick and predicts its own movement; the server replays
 * the inputs, runs the level, and sends `state` ~20x/s with the last input it processed (`ack`). A fight:
 * `encounter`, then the client runs the whole fight itself and sends its `battleInput`s; the server runs the same
 * fight, sends `battleHash` 4 times a second (and `battleSync`, the whole fight, when the client asks), and the
 * last `battleSync` and `battleResult` as it's decided.
 */
import type { Vec2 } from "../core/math.js";
import type { Vitals } from "../battle/player.js";
import type { FightSetup } from "../battle/fight/setup.js";
import type { FightSnapshot } from "../battle/fight/state.js";
import type { Stats } from "../battle/stats.js";
import type { Character } from "../character/character.js";
import type { Bag } from "../items/bag.js";
import type { ItemCounts, ItemId } from "../items/items.js";
import type { LevelLayout } from "../overworld/layout.js";
import type { SavedSettings } from "./client-messages.js";
import type { MsgOf } from "./handlers.js";

/** Something the client should draw on the overworld. `kind` picks the client prefab. */
export interface ActorSnap {
  id: number;
  kind: "boar";
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: 1 | -1;
  /** Noticed you ("!"). */
  alert: boolean;
}

export type ServerMsg =
  /** `character` is null until the player has made one; the level comes only after that. */
  | {
    t: "welcome"; wins: number; vitals: Vitals; stats: Stats; settings: SavedSettings; character: Character | null;
    bag: Bag; dev: boolean;
  }
  /** The character the player made, as saved. */
  | { t: "character"; character: Character }
  | { t: "level"; level: LevelLayout; me: Vec2 }
  /** Sent 20 times a second, so only what moves. The win count comes with `welcome` and `battleResult`. */
  | { t: "state"; ack: number; me: Vec2; actors: ActorSnap[] }
  /** A fight starts. `source`: the actor that touched you, or null for tall grass. `setup`: the fight, to build the
   * same one (the arena, the enemies, every player with the vitals, stats and burden they come in with); you're
   * `setup.players[seat]`. `me`: where you stand on the overworld. */
  | { t: "encounter"; source: number | null; me: Vec2; seat: number; setup: FightSetup }
  /** After every HASH_EVERY_STEPS-th step of the server's fight: its state's `hash` (Fight.hash) after `step`.
   * `lateSteps`: how late your inputs reach the server (the best since the last hash; negative: early), measured
   * on your input up to `heardStep`; your client keeps its fight in step by it (client/src/battle/pace.ts). */
  | { t: "battleHash"; step: number; hash: number; lateSteps: number; heardStep: number }
  /** The server's whole fight after `step`: the answer to `battleResync`, and once more as the fight is decided
   * (then `battleResult` follows). `lateSteps` and `heardStep` as in battleHash. */
  | { t: "battleSync"; step: number; fight: FightSnapshot; lateSteps: number; heardStep: number }
  /** You used one `item`: what it did to your vitals, and your bag now. */
  | { t: "itemUsed"; item: ItemId; vitals: Vitals; bag: Bag }
  /** Your bag, after you moved something in it (whether or not the move was allowed). */
  | { t: "bag"; bag: Bag }
  /** You rested at a campfire: `vitals` are full again. */
  | { t: "rested"; vitals: Vitals }
  /** The fight is decided (sent as it is, while you're still in the arena; you leave it with `leaveBattle`).
   * Losing refills `vitals` and empties the bag: `lost` is what it held. `loot`: what the enemy dropped (winning
   * only), packed into `bag` except `leftBehind`, what there was no room for. */
  | {
    t: "battleResult"; won: boolean; me: Vec2; wins: number; vitals: Vitals; loot: ItemCounts; leftBehind: ItemCounts;
    lost: ItemCounts; bag: Bag;
  };

/** One server message by its `t`: `ServerMsgOf<"state">`. */
export type ServerMsgOf<T extends ServerMsg["t"]> = MsgOf<ServerMsg, T>;
