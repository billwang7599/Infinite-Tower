import { defineComponent } from "../core/ecs.js";
import { roundTo } from "../core/math.js";
import type { Spot, UseSpot } from "../items/gear.js";
import type { Skill, Word } from "../skills/skill.js";
import type { Strike, SwingDir } from "../weapons/hybrid.js";
import type { GuardSide } from "../weapons/weapons.js";

/** What an arena fighter does this step: from the keys in the browser, from `battleInput` on the server. */
export interface PlayerInputData {
  /** World-space move direction, -1..1. */
  moveX: number;
  moveZ: number;
  /** World-space unit vector on the ground: where attacks go (the camera's facing, or the locked enemy). */
  aimX: number;
  aimZ: number;
  /** Held this step. A different attack from the last step's is a new press of it. */
  jump: boolean;
  attack: Strike | null;
  dodge: boolean;
  guard: GuardSide | null;
  guardBreak: boolean;
  way: SwingDir | null;
  block: boolean;
  kick: boolean;
  /** Pressed: the skill only on the step its cast key goes down, and `castHeld` while the key stays down after. */
  cast: Skill | null;
  castHeld: boolean;
  chant: boolean;
  /** Pressed: the chant's words, whole, when they change (sent once, so a long chant isn't resent every step). */
  chantWords: readonly Word[] | null;
  write: PageWrite | null;
  /** The locked enemy, as its index in the fight's enemies. */
  locked: number | null;
  bag: boolean;
  gear: GearMove | null;
  use: UseSpot | null;
}

export interface PageWrite { page: number; skill: Skill }
export interface GearMove { from: Spot; to: Spot; turned: boolean }
export const PlayerInput = defineComponent<PlayerInputData>("PlayerInput");

/** A change of input on the wire: what the player does from fight step `step` on (counted from 1). */
export interface StepInput extends PlayerInputData { step: number }

/** The most changes one `battleInput` message may carry (a frame's worth, with room for a stall). */
export const MAX_INPUTS_PER_MESSAGE = 16;

export const IDLE_INPUT: Readonly<PlayerInputData> = {
  moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: null, dodge: false, guard: null, guardBreak: false,
  way: null, block: false, kick: false, cast: null, castHeld: false, chant: false, chantWords: null, write: null,
  locked: null, bag: false, gear: null, use: null,
};

/** Only the input's own fields (not a StepInput's `step`), copied. */
export const copyInput = (i: PlayerInputData): PlayerInputData => ({
  moveX: i.moveX, moveZ: i.moveZ, aimX: i.aimX, aimZ: i.aimZ, jump: i.jump, attack: i.attack, dodge: i.dodge,
  guard: i.guard, guardBreak: i.guardBreak, way: i.way, block: i.block, kick: i.kick, cast: i.cast,
  castHeld: i.castHeld, chant: i.chant, chantWords: i.chantWords, write: i.write, locked: i.locked, bag: i.bag,
  gear: i.gear, use: i.use,
});

export const sameInput = (a: PlayerInputData, b: PlayerInputData): boolean =>
  a.moveX === b.moveX && a.moveZ === b.moveZ && a.aimX === b.aimX && a.aimZ === b.aimZ && a.jump === b.jump
  && a.attack === b.attack && a.dodge === b.dodge && a.guard === b.guard && a.guardBreak === b.guardBreak
  && a.way === b.way && a.block === b.block && a.kick === b.kick && a.cast === b.cast
  && a.castHeld === b.castHeld && a.chant === b.chant && a.chantWords === b.chantWords && a.write === b.write
  && a.locked === b.locked
  && a.bag === b.bag && a.gear === b.gear && a.use === b.use;

/** Decimals the move and the aim keep on the wire: 0.001 of a direction is far below what anyone can aim. */
const WIRE_DECIMALS = 3;

/** -0 becomes 0, as JSON would make it. */
const forWire = (x: number): number => roundTo(x, WIRE_DECIMALS) || 0;

/** The move and aim rounded for the wire, so the client runs its fight on exactly the server's numbers. */
export function quantizeInput(input: PlayerInputData): PlayerInputData {
  return {
    ...input,
    moveX: forWire(input.moveX), moveZ: forWire(input.moveZ), aimX: forWire(input.aimX), aimZ: forWire(input.aimZ),
  };
}
