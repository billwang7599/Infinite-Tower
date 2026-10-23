/**
 * Client <-> server messages (JSON over a WebSocket at /ws). Types only: both sides import them,
 * nothing here carries game data.
 *
 * Field: the client sends one `input` per fixed tick and predicts its own movement; the server
 * replays the inputs (authoritative), rolls encounters, runs the map boars, and sends `state`
 * ~20x/s with the last input it processed (`ack`) so the client can reconcile.
 */
import type { Vec2 } from "../core/math.js";
import type { ArenaDef, BoarDef } from "../battle/defs.js";
import type { FieldLayout } from "../overworld/field.js";

export type ClientMsg =
  | { t: "input"; seq: number; moveX: number; moveZ: number }
  /** The fight was decided and the player left the arena. */
  | { t: "battleEnd"; won: boolean }
  /** Dev-only commands (the server ignores them in production). */
  | { t: "debug"; cmd: "encounter" };

export interface FieldBoarSnap {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: 1 | -1;
  /** Noticed you ("!"). */
  alert: boolean;
}

export type ServerMsg =
  | { t: "welcome"; field: FieldLayout; arena: ArenaDef; me: Vec2; wins: number; dev: boolean }
  | { t: "state"; ack: number; me: Vec2; boars: FieldBoarSnap[]; wins: number }
  /** `source`: the map boar that touched you, or null for tall grass. */
  | { t: "encounter"; source: number | null; enemy: BoarDef; me: Vec2 }
  /** `accepted: false` when the server refused the client's claimed win. */
  | { t: "battleResult"; won: boolean; accepted: boolean; me: Vec2; wins: number };
