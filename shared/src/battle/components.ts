/** A Fight's state, as plain data. The physics world holds the colliders, by handle. */
import { defineComponent, type Entity } from "../core/ecs.js";
import type { Vec2, Vec3 } from "../core/math.js";
import type { ChargeDef, EnemyDef, LungeDef, SwordDef } from "./defs.js";
import type { AttackKind } from "./sword.js";
import type { Burden } from "../items/burden.js";
import type { Reaction, Status } from "../spells/effects.js";
import type { Spell, Spellbook } from "../spells/spell.js";
import type { PageWrite } from "./input.js";

/**
 * "attack": a swing or the stab (`attack` says which). "stagger": parried, or the guard broken (in hitstun).
 * "write": writing a page, in a chant.
 */
export type PlayerAction = "none" | "attack" | "dodge" | "block" | "stagger" | "cast" | "chant" | "write";

export interface PlayerData {
  grounded: boolean;
  /** Seconds since last on the ground (coyote time). */
  airTime: number;
  jumpHeld: boolean;
  /** The attack held on the last step: a different one is a new press. */
  attackHeld: AttackKind | null;
  dodgeHeld: boolean;
  castHeld: boolean;
  writeHeld: boolean;
  /** Broken off (a stun, a dodge, a cast) while still held: it reopens only once let go. */
  chantBroken: boolean;
  /** Seconds left on a buffered (early) press of jump / attack / dodge / cast, and the attack or spell pressed. */
  jumpBuffer: number;
  attackBuffer: number;
  dodgeBuffer: number;
  castBuffer: number;
  queued: AttackKind | null;
  castQueued: Spell | null;
  casting: Spell | null;
  writing: PageWrite | null;
  book: Spellbook;
  action: PlayerAction;
  /** Seconds since the current action started. */
  actionTime: number;
  /** Direction of the current attack / dodge / block. */
  actionDir: Vec2;
  /** The current (or last) attack, its start (seconds until its blade is live) and its damage multiplier. */
  attack: AttackKind;
  startup: number;
  power: number;
  /** The last swing of the chain going on (null: none), the seconds it lives on after an attack, its momentum. */
  combo: AttackKind | null;
  comboTime: number;
  momentum: number;
  /** How weighed down the player came in (items/burden.ts): dodging costs more, or can't happen; walking slows. */
  burden: Burden;
  wields: { sword: boolean; spellbook: boolean };
}
export const Player = defineComponent<PlayerData>("Player");

export interface HealthData {
  hp: number;
  max: number;
  /** Seconds left of each, after being hit. */
  invuln: number;
  hitstun: number;
  flash: number;
}
export const Health = defineComponent<HealthData>("Health");

export interface StatusData {
  left: Record<Status, number>;
  burnDamagePerSec: number;
  shocks: number;
  shield: number;
  cooldown: Record<Reaction, number>;
}
export const Statuses = defineComponent<StatusData>("Statuses");

export interface SpellShotData {
  caster: Entity;
  spell: Spell;
  segment: number;
  pos: Vec3;
  dir: Vec2;
  flownM: number;
  ignore: Entity | null;
}
export const SpellShot = defineComponent<SpellShotData>("SpellShot");

export interface StaminaData { value: number; max: number; regenDelay: number }
export const Stamina = defineComponent<StaminaData>("Stamina");

/** Code moves a body by setting `vel`; the physics step moves the collider and writes back `pos` and `vel`. */
export interface BodyData {
  /** The collider's center (m). */
  pos: Vec3;
  vel: Vec3;
  /** From the feet up to `pos` (m). */
  centerHeight: number;
  collider: number;
}
export const Body = defineComponent<BodyData>("Body");

export type TeamId = "player" | "enemy";
/** Anything that can hit or be hit. `radius`: its hurt radius on the ground plane. */
export interface FighterData { team: TeamId; radius: number }
export const Fighter = defineComponent<FighterData>("Fighter");

/** An attack's hitbox while its blade (or body) is live: an arc in front, or a ray (a stab). Hits each target once. */
export interface ActiveHitData {
  shape: "arc" | "ray";
  dirX: number;
  dirZ: number;
  /** Reach from the attacker's center to the target's surface (a ray's length). */
  range: number;
  /** An arc's minimum cos(angle) between dir and the target: 1 = straight ahead only, -1 = all around. */
  minDot: number;
  /** A ray's reach either side of its line, to the target's surface. */
  width: number;
  /** A sword's swing or stab, or null: a body blow (a boar's), never parried. */
  attack: AttackKind | null;
  damage: number;
  knockback: number;
  lift: number;
  poiseDamage: number;
  alreadyHit: Set<Entity>;
}
export const ActiveHit = defineComponent<ActiveHitData>("ActiveHit");

/** Where the enemy's target is, refreshed each step before the behaviors run. */
interface EnemySense {
  dist: number;
  /** The yaw that would face the target. */
  toYaw: number;
  /** cos(angle between where the enemy faces and the target): 1 = looking right at it. */
  facingDot: number;
  targetAlive: boolean;
}

/** What the behaviors want this step; the motor turns it into velocity. */
interface EnemyMove {
  dirX: number;
  dirZ: number;
  speed: number;
  accel: number;
  /** Zero the velocity this step (the charge slamming into the wall). */
  halt: boolean;
}

/** The states every enemy has, then each attack's own. Attacks only start from "approach". */
export type EnemyState =
  | "approach" | "stunned" | "parried" | "staggered" | "dead"
  | "lungeWindup" | "lunge" | "lungeRecover"
  | "chargeWindup" | "charge" | "chargeRecover"
  | "swordWindup" | "sword" | "swordRecover";

/** Any arena enemy. Each attack component (below) has its own system; models animate from `state`. */
export interface EnemyData {
  def: EnemyDef;
  state: EnemyState;
  /** Seconds in the current state. */
  stateTime: number;
  /** Seconds the current state lasts ("stunned", "parried", "staggered", a sword's wind-up). */
  duration: number;
  /** Facing (the yaw convention is in core/math.ts). */
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
  /** Seconds until usable again. */
  cooldown: number;
}
export interface ChargeAttackData extends AttackState<ChargeDef> { dir: Vec2 }

/** A swordsman's chains of swings. Its random numbers come from `rng`, a seed kept in the fight (and its hash). */
export interface SwordAttackData extends AttackState<SwordDef> {
  /** The attack winding up, swinging or last swung. */
  attack: AttackKind;
  /** Swings still to come in this chain after the current one. */
  swingsLeft: number;
  rng: number;
  /** Seconds until it can parry again. */
  parryCooldown: number;
}

export const LungeAttack = defineComponent<AttackState<LungeDef>>("LungeAttack");
export const ChargeAttack = defineComponent<ChargeAttackData>("ChargeAttack");
export const SwordAttack = defineComponent<SwordAttackData>("SwordAttack");
