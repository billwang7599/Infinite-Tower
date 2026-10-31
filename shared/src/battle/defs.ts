/**
 * Shapes of the server's battle content (server/src/core/enemies), sent with each encounter. An enemy is a body
 * plus optional attacks, each with its own component and system. Units: seconds, meters, m/s, rad/s.
 */
import type { Hand } from "../items/gear.js";
import type { ItemId } from "../items/items.js";
import type { Modifier, Segment, SkillElement } from "../skills/skill.js";
import type { Line } from "../weapons/one-strike.js";
import type { Stats } from "./stats.js";

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
  posture?: number;
}

/** A short-range lunge with a sweeping hit. */
export interface LungeDef extends AttackDef {
  /** Starts within this center distance. */
  triggerDist: number;
  /** How long the hit is live. */
  active: number;
  speed: number;
  line?: Line;
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

export interface WeaponCounters {
  parryChance: number;
  parryLeadTime: number;
  feintChance: number;
  guardBreakChance: number;
  techChance: number;
  reactTime: number;
}

export interface HybridSwordsmanDef {
  windupTime: number;
  chainWindupTime: number;
  recoverTime: number;
  blockReactTime: number;
  tapParryChance: number;
  kickAfterTime: number;
  kickChance: number;
}

export interface PostureSwordsmanDef {
  windupTime: number;
  chainWindupTime: number;
  delayTime: number;
  delayChance: number;
  minString: number;
  maxString: number;
  perilousChance: number;
  /** Which perilous end, as shares that add up to 1. */
  ends: Record<"thrust" | "sweep" | "grab", number>;
  recoverTime: number;
  deflectChance: number;
  thrustDeflectChance: number;
  sweepStepBackChance: number;
  backOffShare: number;
  backOffM: number;
}

export interface OneStrikeSwordsmanDef {
  thrustWindupTime: number;
  reactTime: number;
  reactJitterTime: number;
  /** Past its thrust's reach (m), from its centre to the target's edge. */
  measureM: number;
  decideMinTime: number;
  decideMaxTime: number;
  /** Matched in reach: shares that add up to 1. */
  matched: Record<"thrust" | "beat" | "wait", number>;
  followChance: number;
  disarmChance: number;
  stepBackChance: number;
}

export interface MasterCutsSwordsmanDef {
  /** On top of the player's wind-ups, so its attacks can be read. */
  windupExtraTime: number;
  reactTime: number;
  answerChance: number;
  cutChance: number;
  minString: number;
  maxString: number;
  fehlerChance: number;
  fehlerLeadTime: number;
  displaceChance: number;
  bindChance: number;
  counterLeadTime: number;
  wrestleChance: number;
  recoverTime: number;
}

export interface WeaponAttackDef {
  /** Starts a chain within this center distance, facing the target. */
  triggerDist: number;
  windup: number;
  chainWindup: number;
  speed: number;
  recover: number;
  minChain: number;
  maxChain: number;
  heavyShare: number;
  /** Before another chain (after recovering), and before its first. */
  cooldown: number;
  firstDelay: number;
  counters?: WeaponCounters;
  hybrid: HybridSwordsmanDef;
  posture: PostureSwordsmanDef;
  oneStrike: OneStrikeSwordsmanDef;
  masterCuts: MasterCutsSwordsmanDef;
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
  weapon?: WeaponAttackDef;
  skill?: SkillAttackDef;
}

export const ENEMY_IDS = ["wild-boar", "kobold-swordsman", "kobold-greatsword", "goblin-warlock"] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export interface EnemyDef {
  id: EnemyId;
  name: string;
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
  posture: number;
  /** One Strike: its low line is its head, a high thrust passes over it. */
  beast?: boolean;
  attacks: EnemyAttacks;
  wielder?: { hands: Partial<Record<Hand, ItemId>>; armReachM: number };
  sidestep?: SidestepDef;
  keepAway?: { nearM: number; farM: number };
  resist?: Partial<Record<SkillElement, number>>;
}
