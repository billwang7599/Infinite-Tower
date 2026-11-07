import { BASE_STATS } from "@infinite-tower/shared";
import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";

export const KOBOLD_SWORDSMAN: Enemy = {
  def: {
    id: "kobold-swordsman",
    name: "Kobold Swordsman",
    maxHp: 160,
    stats: { ...BASE_STATS, skillpower: 0, healthRegen: 0 },
    radius: 0.5,
    heightM: 1.3,
    walkSpeed: 2.6,
    turnRate: 4,
    poise: 80,
    poiseRegen: 10,
    staggerTime: 0.8,
    attacks: {
      weapon: {
        triggerDist: 2.6, windup: 1.1, chainWindup: 0.45, speed: 3, recover: 0.5, minChain: 2, maxChain: 3,
        heavyShare: 0.3, heavyFeintShare: 0.2, cooldown: 1.2, firstDelay: 1.5, blockReactTime: 0.3,
        perfectBlockChance: 0.3, parryChance: 0.15,
      },
    },
    wielder: { hands: { rightHand: "kobold-blade" }, armReachM: 0.8 },
    sidestep: { chance: 0.6, reactTime: 0.25, leadTime: 0.1, speed: 8, stepTime: 0.3 },
  },
  // Its own blade never drops.
  drops: [{ item: "kobold-swordsman-essence", chance: 1, count: 1 }],
  treasure: { uncommon: 0.05, rare: 0.015, epic: 0.004, legendary: 0.001, unique: 0.0002 },
  overworld: () => [
    wander({ speed: 1.2 }),
    chaseOnSight({ range: 4, noticeTime: 0.6, speed: 3 }),
    encounterOnTouch({ range: 0.9 }),
  ],
};
