import { BASE_STATS } from "@infinite-tower/shared";
import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";

export const BOG_LURKER: Enemy = {
  def: {
    id: "bog-lurker",
    name: "Bog Lurker",
    maxHp: 200,
    stats: { ...BASE_STATS, skillpower: 0, healthRegen: 0 },
    radius: 0.9,
    walkSpeed: 1.5,
    turnRate: 1.4,
    knockbackFactor: 0.3,
    poise: 100,
    poiseRegen: 10,
    staggerTime: 1.2,
    attacks: {
      slam: {
        triggerDist: 3, range: 2.6, minDot: 0.5, windup: 1.3, lockAt: 0.35, active: 0.15, recover: 1.5,
        damage: 38, knockback: 12, lift: 4, cooldown: 0.8, firstDelay: 1.5,
        sweep: {
          range: 2.8, minDot: -1, belowDot: 0.3, windup: 0.75, active: 0.2, recover: 1, damage: 20, knockback: 10,
          lift: 2,
        },
      },
    },
  },
  drops: [
    { item: "bog-lurker-essence", chance: 1, count: 1 },
    { item: "lurker-scale", chance: 0.7, count: 2 },
    { item: "bog-pearl", chance: 0.05, count: 1 },
  ],
  treasure: { uncommon: 0.06, rare: 0.02, epic: 0.006, legendary: 0.0015, unique: 0.0003 },
  overworld: () => [
    wander({ speed: 0.7, maxDist: 3 }),
    chaseOnSight({ range: 3.5, noticeTime: 0.8, speed: 2.2 }),
    encounterOnTouch({ range: 1 }),
  ],
};
