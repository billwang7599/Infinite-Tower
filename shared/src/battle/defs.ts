/**
 * Shapes of the server's battle content (server/src/core/content), sent with each encounter. An enemy is a body
 * plus optional attacks, each with its own component and system. Units: seconds, meters, m/s, rad/s.
 */
import type { SpellElement } from "../spells/spell.js";
import type { Stats } from "./stats.js";
import type { AttackKind } from "./sword.js";

export interface ArenaDef {
  radius: number;
}

/** Damage is at strength 10. */
export interface AttackDef {
  range: number;
  /** Minimum cos(angle) to the target: the width of the hit arc. */
  minDot: number;
  windup: number;
  recover: number;
  damage: number;
  knockback: number;
  lift: number;
  /** After recovering. */
  cooldown: number;
  /** From the fight's start to the first use. */
  firstDelay: number;
}

/** A short-range lunge with a sweeping hit. */
export interface LungeDef extends AttackDef {
  /** Starts within this center distance. */
  triggerDist: number;
  /** How long the hit is live. */
  active: number;
  speed: number;
}

/** A long straight rush. Slamming into the arena wall stuns the attacker: the punish window. */
export interface ChargeDef extends AttackDef {
  minDist: number;
  maxDist: number;
  /** Stops tracking the target this long before the charge starts: the dodge cue. */
  lockAt: number;
  speed: number;
  /** Gives up after this long without hitting anything. */
  maxChargeTime: number;
  /** Stunned this long after slamming into the wall. */
  stunTime: number;
}

/**
 * A swordsman's attacks: chains of `minChain` to `maxChain` swings (or stabs), each picked at random from `moves`
 * and never the one just before; each winds up so the player can read it, and lands like the player's do (its hit
 * shape from `length`, sword.ts). On guard (walking up, not attacking, recovering or stunned) and back on guard at
 * least `parryReaction`, it parries a player's swing aimed at it, then can't again for `parryCooldown`; it blocks a
 * stab on guard.
 */
export interface SwordDef {
  length: number;
  damage: number;
  knockback: number;
  lift: number;
  /** Starts a chain within this center distance, facing the target. */
  triggerDist: number;
  /** Wind-up before a chain's first swing, and before each one it chains into. */
  windup: number;
  chainWindup: number;
  /** The blade is live this long, stepping forward at `speed`. */
  active: number;
  speed: number;
  /** After a chain's last swing, before it's on guard again: its opening. */
  recover: number;
  minChain: number;
  maxChain: number;
  moves: AttackKind[];
  /** Before another chain (after recovering), and before its first. */
  cooldown: number;
  firstDelay: number;
  parryReaction: number;
  parryCooldown: number;
}

/**
 * Reading a player's Bolt wind-up aimed at it and stepping out of its line: `leadTime` before the Bolt leaves, but
 * never sooner than `reactTime` into the wind-up, and only when not busy. `chance` per cast, from the fight's seed.
 */
export interface SidestepDef {
  chance: number;
  reactTime: number;
  leadTime: number;
  speed: number;
  stepTime: number;
}

export interface EnemyAttacks {
  lunge?: LungeDef;
  charge?: ChargeDef;
  sword?: SwordDef;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Which 3D model the client builds. */
  model: "boar" | "kobold";
  maxHp: number;
  stats: Stats;
  /** Its body is a ball this big. It shoves players aside however heavy it is; players never push it. */
  radius: number;
  /** At agility 10. */
  walkSpeed: number;
  turnRate: number;
  /** Breaks after enough hits in quick succession: a stagger. */
  poise: number;
  poiseRegen: number;
  staggerTime: number;
  attacks: EnemyAttacks;
  sidestep?: SidestepDef;
  resist?: Partial<Record<SpellElement, number>>;
}
