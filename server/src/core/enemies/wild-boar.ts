import { BASE_STATS } from "@infinite-tower/shared";
import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";

export const WILD_BOAR: Enemy = {
  def: {
    id: "wild-boar",
    name: "Wild Boar",
    maxHp: 160,
    stats: { ...BASE_STATS, skillpower: 0, healthRegen: 0 },
    radius: 0.85,
    walkSpeed: 3.2,
    turnRate: 3.0,
    knockbackFactor: 0.7,
    poise: 36,
    poiseRegen: 8,
    staggerTime: 1.0,
    attacks: {
      lunge: {
        triggerDist: 2.8, range: 2.6, minDot: 0.35,
        windup: 0.65, active: 0.18, recover: 0.75, speed: 6,
        damage: 16, knockback: 8,
        cooldown: 0.6, firstDelay: 0,
      },
      charge: {
        minDist: 5, maxDist: 22, range: 1.9, minDot: 0.2,
        windup: 1.1, lockAt: 0.3, speed: 17, maxChargeTime: 1.6, recover: 0.9, stunTime: 2.2,
        damage: 30, knockback: 15,
        cooldown: 4.5, firstDelay: 2.0,
      },
    },
  },
  drops: [
    { item: "boar-essence", chance: 1, count: 1 },
    { item: "boar-meat", chance: 0.6, count: 1 },
    { item: "boar-hide", chance: 0.35, count: 1 },
    { item: "boar-tusk", chance: 0.25, count: 1 },
  ],
  treasure: { uncommon: 0.03, rare: 0.008, epic: 0.002, legendary: 0.0005, unique: 0.0001 },
  overworld: () => [
    wander({ speed: 1.6 }),
    chaseOnSight({ range: 4.5, noticeTime: 0.5, speed: 3.4 }),
    encounterOnTouch({ range: 0.9 }),
  ],
};
