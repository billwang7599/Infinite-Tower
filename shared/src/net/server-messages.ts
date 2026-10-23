/**
 * Server -> client messages. The server is trusted, so these are plain types (no runtime checks).
 *
 * Flow: `welcome` once, then `level` whenever you enter a level (also right after welcome). In the
 * field the client sends one `input` per fixed tick and predicts its own movement; the server replays
 * the inputs, runs the level, and sends `state` ~20x/s with the last input it processed (`ack`).
 */
import type { Vec2 } from "../core/math.js";
import type { ArenaDef, EnemyDef } from "../battle/defs.js";
import type { LevelLayout } from "../field/layout.js";

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
  | { t: "welcome"; wins: number; dev: boolean }
  | { t: "level"; level: LevelLayout; me: Vec2 }
  | { t: "state"; ack: number; me: Vec2; actors: ActorSnap[]; wins: number }
  /** `source`: the actor that touched you, or null for tall grass. */
  | { t: "encounter"; source: number | null; enemy: EnemyDef; arena: ArenaDef; me: Vec2 }
  /** `accepted: false` when the server refused the client's claimed win. */
  | { t: "battleResult"; won: boolean; accepted: boolean; me: Vec2; wins: number };
