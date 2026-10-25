/** Arena enemies: stats and attacks. Sent to the client with each encounter (it draws and runs the fight). */
import type { EnemyDef } from "@infinite-tower/shared";

const WILD_BOAR: EnemyDef = {
  id: "wild-boar",
  name: "Wild Boar",
  model: "boar",
  maxHp: 160,
  // A boar spends no stamina and casts nothing; its agility and strength are average.
  stats: { stamina: 100, mana: 0, spellpower: 0, agility: 10, strength: 10 },
  radius: 0.85,
  mass: 20,
  walkSpeed: 3.2,
  turnRate: 3.0,
  poise: 36,
  poiseRegen: 8,
  staggerTime: 1.0,
  attacks: {
    lunge: {
      trigger: 2.8, range: 2.6, minDot: 0.35,
      windup: 0.65, active: 0.18, recover: 0.75, speed: 6,
      damage: 16, knockback: 8, lift: 3,
      cooldown: 0.6, firstDelay: 0,
    },
    charge: {
      minDist: 5, maxDist: 22, range: 1.9, minDot: 0.2,
      windup: 1.1, lockAt: 0.3, speed: 17, maxTime: 1.6, recover: 0.9, stun: 2.2,
      damage: 30, knockback: 15, lift: 6,
      cooldown: 4.5, firstDelay: 2.0,
    },
  },
};

export const ENEMIES = { "wild-boar": WILD_BOAR } satisfies Record<string, EnemyDef>;
export type EnemyId = keyof typeof ENEMIES;
