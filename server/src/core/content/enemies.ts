/** Arena enemies: stats and attacks, sent with each encounter. */
import { SWING_DIRS, type EnemyDef } from "@infinite-tower/shared";

const WILD_BOAR: EnemyDef = {
  id: "wild-boar",
  name: "Wild Boar",
  model: "boar",
  maxHp: 160,
  // A boar spends no stamina and casts nothing; its agility and strength are average.
  stats: { stamina: 100, intellect: 0, agility: 10, strength: 10 },
  radius: 0.85,
  walkSpeed: 3.2,
  turnRate: 3.0,
  poise: 36,
  poiseRegen: 8,
  staggerTime: 1.0,
  attacks: {
    lunge: {
      triggerDist: 2.8, range: 2.6, minDot: 0.35,
      windup: 0.65, active: 0.18, recover: 0.75, speed: 6,
      damage: 16, knockback: 8, lift: 3,
      cooldown: 0.6, firstDelay: 0,
    },
    charge: {
      minDist: 5, maxDist: 22, range: 1.9, minDot: 0.2,
      windup: 1.1, lockAt: 0.3, speed: 17, maxChargeTime: 1.6, recover: 0.9, stunTime: 2.2,
      damage: 30, knockback: 15, lift: 6,
      cooldown: 4.5, firstDelay: 2.0,
    },
  },
};

/** Floor 1's swordsman: hit it while it recovers from a chain, or while it's stunned from a parry. */
const KOBOLD_SWORDSMAN: EnemyDef = {
  id: "kobold-swordsman",
  name: "Kobold Swordsman",
  model: "kobold",
  maxHp: 160,
  stats: { stamina: 100, intellect: 0, agility: 10, strength: 10 },
  radius: 0.5,
  walkSpeed: 2.6,
  turnRate: 4,
  poise: 40,
  poiseRegen: 10,
  staggerTime: 0.8,
  attacks: {
    sword: {
      length: 1.1, damage: 14, knockback: 5, lift: 1.5,
      triggerDist: 2.6, windup: 1.1, chainWindup: 0.45, active: 0.12, speed: 3, recover: 0.9,
      minChain: 2, maxChain: 3, moves: [...SWING_DIRS, "stab"],
      cooldown: 1.2, firstDelay: 1.5, parryReaction: 0.3, parryCooldown: 1.5,
    },
  },
};

export const ENEMIES = {
  "wild-boar": WILD_BOAR, "kobold-swordsman": KOBOLD_SWORDSMAN,
} satisfies Record<string, EnemyDef>;
export type EnemyId = keyof typeof ENEMIES;

export const isEnemyId = (id: string): id is EnemyId => Object.hasOwn(ENEMIES, id);
