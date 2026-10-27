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

/**
 * A change of input as the client sends it: what the player does from fight step `step` on (steps count from 1),
 * until the next change. The server runs it on that step (battle/netcode.ts says how late it may come).
 */
export interface StepInput extends PlayerInputData { step: number }

/** The most changes one `battleInput` message may carry (a frame's worth, with room for a stall). */
export const MAX_INPUTS_PER_MESSAGE = 16;

/** Standing still, nothing pressed, facing +z. */
export const IDLE_INPUT: Readonly<PlayerInputData> = {
  moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false,
};

/** Only the input's own fields (not a StepInput's `step`), copied. */
export const copyInput = (i: PlayerInputData): PlayerInputData => ({
  moveX: i.moveX, moveZ: i.moveZ, aimX: i.aimX, aimZ: i.aimZ, jump: i.jump, attack: i.attack, dodge: i.dodge,
});

/** The same move, aim and buttons: nothing new to send. */
export const sameInput = (a: PlayerInputData, b: PlayerInputData): boolean =>
  a.moveX === b.moveX && a.moveZ === b.moveZ && a.aimX === b.aimX && a.aimZ === b.aimZ && a.jump === b.jump
  && a.attack === b.attack && a.dodge === b.dodge;

/** Decimals the move and the aim keep on the wire: 0.001 of a direction is far below what anyone can aim. */
const WIRE_DECIMALS = 3;

/** Rounded for the wire; -0 becomes 0, which is what JSON would make of it. */
const forWire = (x: number): number => roundTo(x, WIRE_DECIMALS) || 0;

/**
 * `input` as it goes over the wire: the move and the aim rounded, so the client runs its fight with exactly the
 * numbers the server will (JSON keeps them as they are).
 */
export function quantizeInput(input: PlayerInputData): PlayerInputData {
  return {
    ...input,
    moveX: forWire(input.moveX), moveZ: forWire(input.moveZ), aimX: forWire(input.aimX), aimZ: forWire(input.aimZ),
  };
}
