/**
 * Shapes of the server's battle content (server/src/core/enemies), sent with each encounter. An enemy is a body
 * plus optional attacks, each with its own component and system. Units: seconds, meters, m/s, rad/s.
 */
import type { Hand } from "../items/gear.js";
import type { ItemId } from "../items/items.js";
import type { Modifier, Segment, SkillElement } from "../skills/skill.js";
import type { Stats } from "./stats.js";

/** Damage is at strength 10. */
export interface AttackDef {
  range: number;
  /** Minimum cos(angle) to the target: the width of the hit arc. */
  minDot: number;
  windup: number;
  recover: number;
  damage: number;
  /** m/s: pushes a guard that blocks it (a hit that lands does damage only). */
  knockback: number;
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

/** `cooldown` (counted once it's back to circling) and `firstDelay` each get up to `cooldownSpread` more, seeded. */
export interface PounceDef extends AttackDef {
  circleM: number;
  circleSpeed: number;
  cooldownSpread: number;
  leapFromM: number;
  /** Stops tracking the target this long before the leap: the dodge cue. */
  lockAt: number;
  speed: number;
  /** How long the leap, and its bite, last. */
  active: number;
  /** `recover` if the bite met someone (taken or blocked), this if it met nobody. */
  missRecover: number;
  hopSpeed: number;
  hopTime: number;
}

export interface SlamDef extends AttackDef {
  /** Starts a slam within this center distance, facing the target. */
  triggerDist: number;
  /** Stops turning toward the target this long before the slam lands: the dodge cue. */
  lockAt: number;
  active: number;
  sweep: SweepDef;
}

/** Starts when the target is within `range` and further off its facing than `belowDot` (a cosine). */
export interface SweepDef extends Omit<AttackDef, "cooldown" | "firstDelay"> {
  belowDot: number;
  active: number;
}

export interface WeaponAttackDef {
  /** Starts a chain within this center distance, facing the target. */
  triggerDist: number;
  windup: number;
  chainWindup: number;
  recover: number;
  minChain: number;
  maxChain: number;
  heavyShare: number;
  heavyFeintShare: number;
  /** Before another chain (after recovering), and before its first. */
  cooldown: number;
  firstDelay: number;
  blockReactTime: number;
  perfectBlockChance: number;
  parryChance: number;
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

export interface SkillAttackDef {
  skill: Segment;
  extras: { modifier: Modifier; chance: number }[];
  quickCastM: number;
  rangeM: number;
  wordTime: number;
  // Counted from when its last cast's effects are gone.
  cooldown: number;
  firstDelay: number;
}

export interface EnemyAttacks {
  lunge?: LungeDef;
  charge?: ChargeDef;
  pounce?: PounceDef;
  slam?: SlamDef;
  weapon?: WeaponAttackDef;
  skill?: SkillAttackDef;
}

export const ENEMY_IDS = [
  "wild-boar", "kobold-swordsman", "kobold-greatsword", "goblin-warlock", "training-dummy", "bram", "grey-wolf",
  "bog-lurker",
] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export interface EnemyDef {
  id: EnemyId;
  name: string;
  maxHp: number;
  stats: Stats;
  /** Its body is a ball this big. It shoves players aside however heavy it is; players never push it. */
  radius: number;
  /** How tall it stands, for what flies at it (an arrow); the ball's height if not given. */
  heightM?: number;
  /** At agility 10. */
  walkSpeed: number;
  turnRate: number;
  knockbackFactor?: number;
  /** Breaks after enough hits in quick succession: a stagger. */
  poise: number;
  poiseRegen: number;
  staggerTime: number;
  attacks: EnemyAttacks;
  wielder?: { hands: Partial<Record<Hand, ItemId>>; armReachM: number };
  sidestep?: SidestepDef;
  keepAway?: { nearM: number; farM: number };
  resist?: Partial<Record<SkillElement, number>>;
  /** Takes no damage, and falls once it's been struck with every kind of strike. */
  dummy?: boolean;
}
