import { BASE_STATS } from "@infinite-tower/shared";
import type { Enemy } from "./index.js";

export const CHICKEN: Enemy = {
  def: {
    id: "chicken",
    name: "Chicken",
    maxHp: 9,
    stats: { ...BASE_STATS, skillpower: 0, healthRegen: 0 },
    radius: 0.3,
    heightM: 0.6,
    walkSpeed: 4.4,
    turnRate: 9,
    poise: 6,
    poiseRegen: 6,
    staggerTime: 0.5,
    attacks: {
      pounce: {
        circleM: 2.6, circleSpeed: 3.4, cooldown: 0.9, cooldownSpread: 1.2, firstDelay: 0.8,
        leapFromM: 3.6, windup: 0.45, lockAt: 0.15, speed: 9, active: 0.25, range: 0.8, minDot: 0.5,
        damage: 2, knockback: 2, recover: 0.3, missRecover: 0.7, hopSpeed: 8, hopTime: 0.4,
      },
    },
  },
  drops: [],
  treasure: {},
  overworld: () => [],
};
