/**
 * Shapes of server-owned battle content. The values live in server/src/core/content and reach the client
 * with each encounter (the client builds the same fight to draw it and predict its own player).
 *
 * An enemy is a body plus a set of optional attacks. The fight's enemy spawn (fight/setup.ts) adds one component
 * per attack (LungeAttack, ChargeAttack, ...), and each attack has its own system, so a new enemy is
 * mostly a new combination of existing attacks.
 *
 * Units: seconds, meters, m/s, rad/s.
 */

import type { Stats } from "./stats.js";

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

export interface EnemyAttacks {
  lunge?: LungeDef;
  charge?: ChargeDef;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Which 3D model the client builds (client/src/battle/enemies/models). */
  model: "boar";
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
