import { defineComponent } from "../core/ecs.js";

/**
 * What an arena fighter wants to do this tick. Filled from the keyboard/mouse for the local player now,
 * from network messages later. (The field uses the simpler WalkInput, see field/layout.ts.)
 */
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
