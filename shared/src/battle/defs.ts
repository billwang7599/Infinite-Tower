/**
 * Shapes of server-owned battle content. The values live in server/src/core/content and reach the client
 * with each encounter (the client builds the same fight and runs its own copy).
 *
 * An enemy is a body plus a set of optional attacks. The fight's enemy spawn (fight/setup.ts) adds one component
 * per attack (LungeAttack, ChargeAttack, ...), and each attack has its own system, so a new enemy is
 * mostly a new combination of existing attacks.
 *
 * Units: seconds, meters, m/s, rad/s.
 */

import type { Stats } from "./stats.js";
import type { AttackKind } from "./sword.js";

export interface ArenaDef {
  radius: number;
}

/** What every attack has: reach, timing, damage (at strength 10). */
export interface AttackDef {
  range: number;
  /** Minimum cos(angle) to the target: the width of the hit arc. */
  minDot: number;
  windup: number;
  recover: number;
  damage: number;
  knockback: number;
  lift: number;
  /** Seconds before it can be used again (after recovering). */
  cooldown: number;
  /** Seconds after the fight starts before the first use. */
  firstDelay: number;
}

/** A short-range lunge with a sweeping hit. */
export interface LungeDef extends AttackDef {
  /** Start the attack within this center distance. */
  triggerDist: number;
  /** Seconds the hit is live. */
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
  /** The charge gives up after this many seconds without hitting anything. */
  maxChargeTime: number;
  /** Seconds stunned after slamming into the wall. */
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
  /** Seconds of wind-up before a chain's first swing, and before each one it chains into. */
  windup: number;
  chainWindup: number;
  /** Seconds the blade is live, stepping forward this fast (m/s). */
  active: number;
  speed: number;
  /** Seconds after a chain's last swing before it's on guard again: its opening. */
  recover: number;
  minChain: number;
  maxChain: number;
  moves: AttackKind[];
  /** Seconds before it can start another chain (after recovering), and before its first. */
  cooldown: number;
  firstDelay: number;
  parryReaction: number;
  parryCooldown: number;
}

export interface EnemyAttacks {
  lunge?: LungeDef;
  charge?: ChargeDef;
  sword?: SwordDef;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Which 3D model the client builds (client/src/battle/enemies/models). */
  model: "boar" | "kobold";
  maxHp: number;
  stats: Stats;
  /** Its body is a ball this big. It shoves players aside however heavy it is; players never push it. */
  radius: number;
  /** At agility 10. */
  walkSpeed: number;
  /** rad/s */
  turnRate: number;
  /** Poise breaks after enough hits in quick succession -> stagger. */
  poise: number;
  poiseRegen: number;
  staggerTime: number;
  attacks: EnemyAttacks;
}
