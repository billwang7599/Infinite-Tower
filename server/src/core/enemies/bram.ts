import { BASE_STATS, PLAYER } from "@infinite-tower/shared";
import type { Enemy } from "./index.js";

export const BRAM: Enemy = {
  def: {
    id: "bram",
    name: "Bram",
    maxHp: 60,
    stats: { ...BASE_STATS, skillpower: 0, healthRegen: 0 },
    radius: 0.45,
    walkSpeed: 2.2,
    turnRate: 3,
    poise: 60,
    poiseRegen: 10,
    staggerTime: 0.8,
    attacks: {
      weapon: {
        triggerDist: 2.4, windup: 1.3, chainWindup: 0.6, speed: 2.6, recover: 0.7, minChain: 1, maxChain: 2,
        heavyShare: 0.2, heavyFeintShare: 0, cooldown: 1.8, firstDelay: 2, blockReactTime: 0.35,
        perfectBlockChance: 0.1, parryChance: 0,
      },
    },
    wielder: { hands: { rightHand: "old-stick" }, armReachM: PLAYER.armReachM },
  },
  drops: [],
  treasure: {},
  overworld: () => [],
};
