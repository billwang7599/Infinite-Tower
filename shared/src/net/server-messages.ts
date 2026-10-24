/**
 * Server -> client messages. The server is trusted, so these are plain types (no runtime checks).
 *
 * Flow: `welcome` once, then `level` whenever you enter a level (also right after welcome). In the
 * field the client sends one `input` per fixed tick and predicts its own movement; the server replays
 * the inputs, runs the level, and sends `state` ~20x/s with the last input it processed (`ack`).
 */
import type { Vec2 } from "../core/math.js";
import type { Vitals } from "../battle/constants.js";
import type { ArenaDef, EnemyDef } from "../battle/defs.js";
import type { Stats } from "../battle/stats.js";
import type { Character } from "../character/character.js";
import type { LevelLayout } from "../field/layout.js";
import type { SavedSettings } from "./client-messages.js";

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
  | { t: "welcome"; wins: number; vitals: Vitals; stats: Stats; settings: SavedSettings; character: Character | null; dev: boolean }
  /** The character the player made or changed, as saved. */
  | { t: "character"; character: Character }
  | { t: "level"; level: LevelLayout; me: Vec2 }
  | { t: "state"; ack: number; me: Vec2; actors: ActorSnap[]; wins: number }
  /** `source`: the actor that touched you, or null for tall grass. `vitals`, `stats`: what you start the fight with. */
  | { t: "encounter"; source: number | null; enemy: EnemyDef; arena: ArenaDef; me: Vec2; vitals: Vitals; stats: Stats }
  /** You rested at a campfire: `vitals` are full again. */
  | { t: "rested"; vitals: Vitals }
  /** `accepted: false` when the server refused the client's claimed win. Losing refills `vitals`. */
  | { t: "battleResult"; won: boolean; accepted: boolean; me: Vec2; wins: number; vitals: Vitals };
