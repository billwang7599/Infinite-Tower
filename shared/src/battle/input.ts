import { defineComponent } from "../core/ecs.js";
import { roundTo } from "../core/math.js";

/**
 * What an arena fighter wants to do this step: from the keyboard / mouse on the player's own machine, and from their
 * `battleInput` messages on the server. (The overworld uses the simpler WalkInput, see overworld/layout.ts.)
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

/** One step's input as the client sends it. `seq` numbers the client's steps of the fight, from 1. */
export interface BattleInput extends PlayerInputData { seq: number }

/** The most steps one `battleInput` message may carry (a frame's worth, with room for a stall). */
export const MAX_INPUTS_PER_MESSAGE = 16;

/** Standing still, nothing pressed, facing +z. */
export const IDLE_INPUT: Readonly<PlayerInputData> = {
  moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false,
};

/**
 * Standing still with nothing pressed (where it aims doesn't matter then). The client doesn't send an idle step that
 * follows another: the server runs the last input again when none has come, which is the same thing.
 */
export const isIdle = (input: PlayerInputData): boolean =>
  input.moveX === 0 && input.moveZ === 0 && !input.jump && !input.attack && !input.dodge;

/** Decimals the move and the aim keep on the wire: 0.001 of a direction is far below what anyone can aim. */
const WIRE_DECIMALS = 3;

/** Rounded for the wire; -0 becomes 0, which is what JSON would make of it. */
const forWire = (x: number): number => roundTo(x, WIRE_DECIMALS) || 0;

/**
 * `input` as it goes over the wire: the move and the aim rounded, so the client predicts with exactly the numbers
 * the server will run (JSON keeps them as they are).
 */
export function quantizeInput(input: PlayerInputData): PlayerInputData {
  return {
    ...input,
    moveX: forWire(input.moveX), moveZ: forWire(input.moveZ), aimX: forWire(input.aimX), aimZ: forWire(input.aimZ),
  };
}
