/**
 * Arena-fight components. The fight still runs in the client for now; a server-side fight would reuse these.
 * Plain data only. Engine handles (meshes, physics bodies) live in client/src/components.ts.
 */
import { defineComponent, type Entity } from "../core/ecs.js";
import type { Vec2 } from "../core/math.js";
import type { BoarDef } from "./defs.js";

export type PlayerAction = "none" | "slash" | "dodge";

export interface PlayerData {
  name: string;
  grounded: boolean;
  /** Seconds since last on ground (coyote time). */
  airTime: number;
  jumpBuffer: number;
  jumpHeld: boolean;
  attackHeld: boolean;
  dodgeHeld: boolean;
  /** Seconds left on a buffered press. */
  attackBuffer: number;
  dodgeBuffer: number;
  action: PlayerAction;
  /** Seconds since the current action started. */
  actionTime: number;
  /** Direction of the current slash / dodge. */
  actionDir: Vec2;
  /** Counts slashes, so swings alternate sides. */
  combo: number;
}
export const Player = defineComponent<PlayerData>("Player");

/** Marks the player controlled on this machine. */
export const LocalPlayer = defineComponent<true>("LocalPlayer");

export interface HealthData {
  hp: number;
  max: number;
  /** Seconds of invulnerability left (after being hit). */
  invuln: number;
  /** Seconds left without control (after being hit). */
  hitstun: number;
  /** Seconds left of the hit flash (visual). */
  flash: number;
}
export const Health = defineComponent<HealthData>("Health");

export interface StaminaData { value: number; max: number; regenDelay: number }
export const Stamina = defineComponent<StaminaData>("Stamina");

export type TeamId = "player" | "enemy";
/** Anything that can hit or be hit. `radius` is its hurt radius on the ground plane. */
export interface FighterData { team: TeamId; radius: number }
export const Fighter = defineComponent<FighterData>("Fighter");

/**
 * An attack's hitbox while it is active: a sector in front of the attacker.
 * Added when the swing/charge becomes active, removed when it ends. Each target is hit at most once.
 */
export interface ActiveHitData {
  dirX: number;
  dirZ: number;
  /** Reach from the attacker's center to the target's surface. */
  range: number;
  /** Minimum cos(angle) between dir and the target: 1 = straight ahead only, -1 = all around. */
  minDot: number;
  damage: number;
  knockback: number;
  lift: number;
  poise: number;
  hit: Set<Entity>;
}
export const ActiveHit = defineComponent<ActiveHitData>("ActiveHit");

export type BoarState =
  | "approach" | "goreWindup" | "gore" | "goreRecover"
  | "chargeWindup" | "charge" | "chargeRecover"
  | "stunned" | "staggered" | "dead";

export interface BoarData {
  /** Stats, sent by the server with the encounter. */
  def: BoarDef;
  state: BoarState;
  /** Seconds in the current state. */
  t: number;
  /** Facing (see yaw convention in constants.ts). */
  yaw: number;
  chargeCooldown: number;
  goreCooldown: number;
  chargeDir: Vec2;
  poise: number;
}
export const Boar = defineComponent<BoarData>("Boar");
