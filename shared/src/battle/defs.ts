/**
 * Shapes of server-owned battle content. The values live in server/src/core/content and reach the client
 * with each encounter (the client needs them to draw and, for now, to run the fight).
 *
 * An enemy is a body plus a set of optional attacks. The client's enemy prefab adds one component
 * per attack (GoreAttack, ChargeAttack, ...), and each attack has its own system, so a new enemy is
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
export interface GoreDef extends AttackDef {
  /** Start the attack within this center distance. */
  trigger: number;
  /** Seconds the hit is live. */
  active: number;
  lunge: number;
}

/** A long straight rush. Slamming into the arena wall stuns the attacker: the punish window. */
export interface ChargeDef extends AttackDef {
  minDist: number;
  maxDist: number;
  /** Stops tracking the target this long before the charge starts: the dodge cue. */
  lockAt: number;
  speed: number;
  maxTime: number;
  stun: number;
}

export interface EnemyAttacks {
  gore?: GoreDef;
  charge?: ChargeDef;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Which 3D model the client builds (client/src/battle/enemies/models). */
  model: "boar";
  maxHp: number;
  stats: Stats;
  radius: number;
  mass: number;
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
