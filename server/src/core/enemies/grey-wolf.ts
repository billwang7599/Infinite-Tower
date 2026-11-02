import { BASE_STATS } from "@infinite-tower/shared";
import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";

export const GREY_WOLF: Enemy = {
  def: {
    id: "grey-wolf",
    name: "Grey Wolf",
    maxHp: 70,
    stats: { ...BASE_STATS, skillpower: 0, healthRegen: 0 },
    radius: 0.55,
    walkSpeed: 4.6,
    turnRate: 7,
    poise: 30,
    poiseRegen: 12,
    staggerTime: 0.7,
    attacks: {
      pounce: {
        circleM: 4.5, circleSpeed: 3.2, cooldown: 1.2, cooldownSpread: 1.6, firstDelay: 1,
        leapFromM: 6.5, windup: 0.6, lockAt: 0.2, speed: 13, active: 0.35, range: 1, minDot: 0.5,
        damage: 14, knockback: 6, lift: 2, recover: 0.45, missRecover: 1.1, hopSpeed: 8, hopTime: 0.3,
      },
    },
  },
  drops: [
    { item: "grey-wolf-essence", chance: 1, count: 1 },
    { item: "wolf-pelt", chance: 0.35, count: 1 },
    { item: "wolf-fang", chance: 0.6, count: 1 },
  ],
  treasure: { uncommon: 0.04, rare: 0.01, epic: 0.0025, legendary: 0.0006, unique: 0.0001 },
  overworld: () => [
    wander({ speed: 1.8 }),
    chaseOnSight({ range: 5, noticeTime: 0.4, speed: 4.2 }),
    encounterOnTouch({ range: 0.9, enemy: "grey-wolf" }),
  ],
};
