import { BASE_STATS } from "@infinite-tower/shared";
import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";

export const GOBLIN_WARLOCK: Enemy = {
  def: {
    id: "goblin-warlock",
    name: "Goblin Warlock",
    maxHp: 40,
    stats: { ...BASE_STATS, healthRegen: 0 },
    radius: 0.45,
    walkSpeed: 2.4,
    turnRate: 4,
    poise: 20,
    poiseRegen: 8,
    staggerTime: 1.0,
    keepAway: { nearM: 4, farM: 7 },
    attacks: {
      lunge: {
        triggerDist: 1.6, range: 1.5, minDot: 0.6,
        windup: 0.4, active: 0.15, recover: 0.5, speed: 2,
        damage: 5, knockback: 3, lift: 0.5,
        cooldown: 0.8, firstDelay: 0,
      },
      skill: {
        skill: { form: "bolt", elements: ["fire"], modifiers: [] },
        extras: [{ modifier: "follow", chance: 1 / 3 }, { modifier: "split", chance: 1 / 4 }],
        quickCastM: 6, rangeM: 14, wordTime: 0.45, cooldown: 1.2, firstDelay: 1,
      },
    },
  },
  drops: [{ item: "goblin-warlock-essence", chance: 1, count: 1 }],
  overworld: () => [
    wander({ speed: 1.2 }),
    chaseOnSight({ range: 4, noticeTime: 0.6, speed: 3 }),
    encounterOnTouch({ range: 0.9, enemy: "goblin-warlock" }),
  ],
};
