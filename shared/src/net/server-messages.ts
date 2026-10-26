/**
 * Server -> client messages. The server is trusted, so these are plain types (no runtime checks).
 *
 * Flow: `welcome` once, then `level` whenever you enter a level (also right after welcome). In the
 * field the client sends one `input` per fixed tick and predicts its own movement; the server replays
 * the inputs, runs the level, and sends `state` ~20x/s with the last input it processed (`ack`).
 */
import type { Vec2 } from "../core/math.js";
import type { Vitals } from "../battle/player.js";
import type { ArenaDef, EnemyDef } from "../battle/defs.js";
import type { Stats } from "../battle/stats.js";
import type { Character } from "../character/character.js";
import type { Bag } from "../items/bag.js";
import type { ItemCounts, ItemId } from "../items/items.js";
import type { LevelLayout } from "../field/layout.js";
import type { SavedSettings } from "./client-messages.js";
import type { MsgOf } from "./handlers.js";

/** Something the client should draw on the field. `kind` picks the client prefab. */
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
  /** `source`: the actor that touched you, or null for tall grass. `vitals`, `stats`: what you start the fight with. */
  | { t: "encounter"; source: number | null; enemy: EnemyDef; arena: ArenaDef; me: Vec2; vitals: Vitals; stats: Stats }
  /** You used one `item`: what it did to your vitals, and your bag now. */
  | { t: "itemUsed"; item: ItemId; vitals: Vitals; bag: Bag }
  /** Your bag, after you moved something in it (whether or not the move was allowed). */
  | { t: "bag"; bag: Bag }
  /** You rested at a campfire: `vitals` are full again. */
  | { t: "rested"; vitals: Vitals }
  /** `accepted: false` when the server refused the client's claimed win. Losing refills `vitals`. `loot`: what the
   * enemy dropped (winning only), packed into `bag` except `leftBehind`, what there was no room for. */
  | {
    t: "battleResult"; won: boolean; accepted: boolean; me: Vec2; wins: number; vitals: Vitals; loot: ItemCounts;
    leftBehind: ItemCounts; bag: Bag;
  };

/** One server message by its `t`: `ServerMsgOf<"state">`. */
export type ServerMsgOf<T extends ServerMsg["t"]> = MsgOf<ServerMsg, T>;
