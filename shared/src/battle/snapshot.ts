/**
 * A fight on the wire: what the server's `battleState` carries (net/server-messages.ts). The player's own fighter
 * comes exactly (`PlayerState`), so their client can put it back where the server has it and replay from there
 * (prediction); everyone else comes rounded, with just what it takes to draw them.
 */
import type { Vec3 } from "../core/math.js";
import type { EnemyState, HealthData, PlayerAction, PlayerData, StaminaData, TeamId } from "./components.js";

/** One player's whole state as their own steps change it, unrounded (fight/player-state.ts reads and writes it). */
export interface PlayerState {
  pos: Vec3;
  vel: Vec3;
  /** The Player component, but for `burden` (set for the whole fight). */
  player: Omit<PlayerData, "burden">;
  health: Omit<HealthData, "max">;
  stamina: Omit<StaminaData, "max">;
}

/** Any fighter as others draw it: position and velocity rounded to 1 cm (and cm/s), HP, the hit flash's seconds. */
export interface FighterSnap {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; hp: number; flash: number;
}

/** An enemy: which way it faces (rad), and its state and how long it's been in it (seconds), for its animation. */
export interface EnemySnap extends FighterSnap { yaw: number; state: EnemyState; stateTime: number }

/** Another player: what they're doing and where (their sprite's pose and trail), on the ground, blinking. */
export interface PlayerSnap extends FighterSnap {
  action: PlayerAction;
  actionTime: number;
  dirX: number;
  dirZ: number;
  grounded: boolean;
  invuln: number;
}

/**
 * Something that happened in the fight, for the client to show (the camera shakes). Fighters are numbered the same
 * on both sides: the players in seat order, then the enemies.
 */
export type BattleEvent =
  | { type: "hit"; target: number; team: TeamId; damage: number }
  /** A charging enemy slammed into the wall. */
  | { type: "slam"; fighter: number };
