/**
 * Arena-fight components. The fight still runs in the client for now; a server-side fight would reuse these.
 * Plain data only. Engine handles (meshes, physics bodies) live in client/src/battle/components.ts.
 */
import { defineComponent, type Entity } from "../core/ecs.js";
import type { Vec2 } from "../core/math.js";
import type { ChargeDef, EnemyDef, GoreDef } from "./defs.js";

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

/**
 * Any arena enemy. Its AI is split into behaviors: the enemy systems handle approaching, poise,
 * stagger, stun and death; each attack component (below) has its own system that starts the attack
 * and runs its phases. `state` is the current state name, e.g. "approach" or "chargeWindup" (attack
 * systems use their own names). Models animate from it.
 */
export interface EnemyData {
  def: EnemyDef;
  state: string;
  /** Seconds in the current state. */
  t: number;
  /** Seconds the current generic state lasts ("stunned", "staggered"). */
  duration: number;
  /** Facing (see yaw convention in core/math.ts). */
  yaw: number;
  poise: number;
  /** Can't be staggered right now (mid-charge, say). Attack systems set it each step. */
  armored: boolean;
  /** Where the target is, refreshed each step before the behaviors run. */
  sense: { dist: number; toYaw: number; facing: number; preyAlive: boolean };
  /** What the behaviors want this step; the motor turns it into velocity. */
  move: { dirX: number; dirZ: number; speed: number; accel: number; halt: boolean };
}
export const Enemy = defineComponent<EnemyData>("Enemy");

/** Enemy states every enemy has. Attack systems may only start from "approach". */
export type EnemyBaseState = "approach" | "stunned" | "staggered" | "dead";

export interface AttackState<D> {
  def: D;
  /** Seconds until usable again (ticks down all the time). */
  cooldown: number;
}
export interface ChargeAttackData extends AttackState<ChargeDef> { dir: Vec2 }

export const GoreAttack = defineComponent<AttackState<GoreDef>>("GoreAttack");
export const ChargeAttack = defineComponent<ChargeAttackData>("ChargeAttack");
