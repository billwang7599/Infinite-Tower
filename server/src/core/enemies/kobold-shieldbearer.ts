import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";
import { KOBOLD_SWORDSMAN } from "./kobold-swordsman.js";

const SWORDSMAN = KOBOLD_SWORDSMAN.def;

export const KOBOLD_SHIELDBEARER: Enemy = {
  def: {
    ...SWORDSMAN,
    id: "kobold-shieldbearer",
    name: "Kobold Shieldbearer",
    maxHp: 150,
    poise: 60,
    poiseRegen: 8,
    attacks: {
      weapon: {
        ...SWORDSMAN.attacks.weapon!, minChain: 1, maxChain: 2, cooldown: 1.5, blockReactTime: 0.2,
        perfectBlockChance: 0.2, parryChance: 0,
      },
    },
    wielder: { hands: { rightHand: "kobold-blade", leftHand: "wooden-shield" }, armReachM: 0.8 },
  },
  drops: [{ item: "kobold-shieldbearer-essence", chance: 1, count: 1 }],
  treasure: { uncommon: 0.05, rare: 0.015, epic: 0.004, legendary: 0.001, unique: 0.0002 },
  overworld: () => [
    wander({ speed: 1.2 }),
    chaseOnSight({ range: 4, noticeTime: 0.6, speed: 3 }),
    encounterOnTouch({ range: 0.9 }),
  ],
};
