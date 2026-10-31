import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";

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
        triggerDist: 2.6, windup: 0.5, chainWindup: 0.35, speed: 3, recover: 0.9, minChain: 2, maxChain: 3,
        heavyShare: 0.3, cooldown: 1.2, firstDelay: 1.5,
        counters: {
          parryChance: 0.35, parryLeadTime: 0.2, feintChance: 0.25, guardBreakChance: 0.25, techChance: 0.3,
          reactTime: 0.25,
        },
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
