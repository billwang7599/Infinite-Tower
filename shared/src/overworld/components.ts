/**
 * Overworld (2D map) components. Map entities are separate from the arena fighters; both live in
 * the same World. Plain data only.
 */
import { defineComponent } from "../core/ecs.js";

/** Position on the 2D map (tiles). */
export interface MapPosData { x: number; z: number }
export const MapPos = defineComponent<MapPosData>("MapPos");

export interface MapPlayerData {
  vx: number;
  vz: number;
  facing: 1 | -1;
  /** Tiles walked in tall grass since the last encounter roll. */
  grassDist: number;
  /** Seconds left without encounters (after a fight). */
  safeTime: number;
}
export const MapPlayer = defineComponent<MapPlayerData>("MapPlayer");

export type MapBoarState = "idle" | "wander" | "notice" | "chase";
export interface MapBoarData {
  state: MapBoarState;
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
export const MapBoar = defineComponent<MapBoarData>("MapBoar");
