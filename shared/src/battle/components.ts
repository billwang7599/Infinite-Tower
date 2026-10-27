/**
 * Arena-fight components: the state of a Fight (battle/fight/). Plain data only; the physics world holds the
 * colliders (by handle) and the client's drawings hang off the same entities (client/src/battle/components.ts).
 */
import { defineComponent, type Entity } from "../core/ecs.js";
import type { Vec2, Vec3 } from "../core/math.js";
import type { ChargeDef, EnemyDef, LungeDef } from "./defs.js";
import type { Burden } from "../items/burden.js";

export type PlayerAction = "none" | "slash" | "dodge";

export interface PlayerData {
  grounded: boolean;
  /** Seconds since last on ground (coyote time). */
  airTime: number;
  jumpHeld: boolean;
  attackHeld: boolean;
  dodgeHeld: boolean;
  /** Seconds left on a buffered (early) press of jump / attack / dodge. */
  jumpBuffer: number;
  attackBuffer: number;
  dodgeBuffer: number;
  action: PlayerAction;
  /** Seconds since the current action started. */
  actionTime: number;
  /** Direction of the current slash / dodge. */
  actionDir: Vec2;
  /** How weighed down the player came in (items/burden.ts): dodging costs more, or can't happen; walking slows. */
  burden: Burden;
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

/**
 * A fighter's body in the arena's physics. Code moves it by setting `vel`; each step the physics moves the collider
 * that far, stopped and slid by the ground and the wall, and writes back where it got to and how fast it went.
 */
export interface BodyData {
  /** The collider's center (m). */
  pos: Vec3;
  /** m/s. */
  vel: Vec3;
  /** From the feet up to `pos` (m). */
  centerHeight: number;
  /** The collider's handle in the fight's ArenaPhysics. */
  collider: number;
}
export const Body = defineComponent<BodyData>("Body");

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
  poiseDamage: number;
  /** Targets this attack has already hit. */
  alreadyHit: Set<Entity>;
}
export const ActiveHit = defineComponent<ActiveHitData>("ActiveHit");

/** Where the enemy's target is, refreshed each step before the behaviors run. */
export interface EnemySense {
  dist: number;
  /** The yaw that would face the target. */
  toYaw: number;
  /** cos(angle between where the enemy faces and the target): 1 = looking right at it. */
  facingDot: number;
  targetAlive: boolean;
}

/** What the behaviors want this step; the motor turns it into velocity. */
export interface EnemyMove {
  dirX: number;
  dirZ: number;
  speed: number;
  accel: number;
  /** Zero the velocity this step (the charge slamming into the wall). */
  halt: boolean;
}

/**
 * What an enemy is doing: the states every enemy has, then each attack's own. Attacks may only start from
 * "approach". A new attack adds its states here.
 */
export type EnemyState =
  | "approach" | "stunned" | "staggered" | "dead"
  | "lungeWindup" | "lunge" | "lungeRecover"
  | "chargeWindup" | "charge" | "chargeRecover";

/**
 * Any arena enemy. Its AI is split into behaviors: the enemy systems handle approaching, poise,
 * stagger, stun and death; each attack component (below) has its own system that starts the attack
 * and runs its phases. Models animate from `state`.
 */
export interface EnemyData {
  def: EnemyDef;
  state: EnemyState;
  /** Seconds in the current state. */
  stateTime: number;
  /** Seconds the current generic state lasts ("stunned", "staggered"). */
  duration: number;
  /** Facing (see yaw convention in core/math.ts). */
  yaw: number;
  poise: number;
  /** Can't be staggered right now (mid-charge, say). Attack systems set it each step. */
  armored: boolean;
  sense: EnemySense;
  move: EnemyMove;
}
export const Enemy = defineComponent<EnemyData>("Enemy");

export interface AttackState<D> {
  def: D;
  /** Seconds until usable again (ticks down all the time). */
  cooldown: number;
}
export interface ChargeAttackData extends AttackState<ChargeDef> { dir: Vec2 }

export const LungeAttack = defineComponent<AttackState<LungeDef>>("LungeAttack");
export const ChargeAttack = defineComponent<ChargeAttackData>("ChargeAttack");
