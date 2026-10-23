/** Server-side field state. The client only ever sees the snapshot of it (FieldBoarSnap, positions). */
import { defineComponent, type Vec2 } from "@infinite-tower/shared";

export const FieldPos = defineComponent<Vec2>("FieldPos");

export interface QueuedInput { seq: number; moveX: number; moveZ: number }

export interface FieldPlayerData {
  vx: number;
  vz: number;
  /** Inputs received but not yet simulated. */
  queue: QueuedInput[];
  /** Inputs the player may still simulate: +1 per tick, capped, so a client can't move faster by sending more. */
  credits: number;
  /** Seq of the last input simulated. */
  ack: number;
  /** Tiles walked in tall grass since the last encounter roll. */
  grassDist: number;
  /** Seconds left without encounters. */
  safeTime: number;
}
export const FieldPlayer = defineComponent<FieldPlayerData>("FieldPlayer");

export type FieldBoarState = "idle" | "wander" | "notice" | "chase";
export interface FieldBoarData {
  state: FieldBoarState;
  t: number;
  /** How long to idle. */
  duration: number;
  /** Wander target. */
  tx: number;
  tz: number;
  vx: number;
  vz: number;
  facing: 1 | -1;
}
export const FieldBoar = defineComponent<FieldBoarData>("FieldBoar");
