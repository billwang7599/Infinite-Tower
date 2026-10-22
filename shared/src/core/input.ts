import { defineComponent } from "./ecs.js";

/** What a player wants to do this tick (arena and map). Filled by local input now, by network messages later. */
export interface PlayerInputData {
  /** World-space move direction, -1..1. */
  moveX: number;
  moveZ: number;
  /** World-space unit vector on the ground: where attacks go (the camera's facing). */
  aimX: number;
  aimZ: number;
  /** Held this tick. */
  jump: boolean;
  attack: boolean;
  dodge: boolean;
}
export const PlayerInput = defineComponent<PlayerInputData>("PlayerInput");
