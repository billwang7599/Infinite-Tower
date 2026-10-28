import { SWING_DIRS } from "@infinite-tower/shared";
import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";

/** Floor 1's swordsman: hit it while it recovers from a chain, or while it's stunned from a parry. */
export const KOBOLD_SWORDSMAN: Enemy = {
  def: {
    id: "kobold-swordsman",
    name: "Kobold Swordsman",
    maxHp: 160,
    stats: { stamina: 100, skillpower: 0, agility: 10, strength: 10 },
    radius: 0.5,
    walkSpeed: 2.6,
    turnRate: 4,
    poise: 40,
    poiseRegen: 10,
    staggerTime: 0.8,
    attacks: {
      weapon: {
        knockback: 5, lift: 1.5,
        triggerDist: 2.6, windup: 1.1, chainWindup: 0.45, active: 0.12, speed: 3, recover: 0.9,
        minChain: 2, maxChain: 3, moves: [...SWING_DIRS, "stab"],
        cooldown: 1.2, firstDelay: 1.5, parryReaction: 0.3, parryCooldown: 1.5,
      },
    },
    wielder: { hands: { rightHand: "kobold-blade" }, armReachM: 0.8 },
    sidestep: { chance: 0.6, reactTime: 0.25, leadTime: 0.1, speed: 8, stepTime: 0.3 },
  },
  // Its own blade never drops.
  drops: [],
  overworld: () => [
    wander({ speed: 1.2 }),
    chaseOnSight({ range: 4, noticeTime: 0.6, speed: 3 }),
    encounterOnTouch({ range: 0.9, enemy: "kobold-swordsman" }),
  ],
};
