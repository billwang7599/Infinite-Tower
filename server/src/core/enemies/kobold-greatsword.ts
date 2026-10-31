import { chaseOnSight } from "../overworld/behaviors/chase.js";
import { encounterOnTouch } from "../overworld/behaviors/touch.js";
import { wander } from "../overworld/behaviors/wander.js";
import type { Enemy } from "./index.js";
import { KOBOLD_SWORDSMAN } from "./kobold-swordsman.js";

export const KOBOLD_GREATSWORD: Enemy = {
  def: {
    ...KOBOLD_SWORDSMAN.def,
    id: "kobold-greatsword",
    name: "Kobold Greatsword",
    wielder: { hands: { rightHand: "kobold-greatsword" }, armReachM: 0.8 },
  },
  drops: [{ item: "kobold-greatsword-essence", chance: 1, count: 1 }],
  overworld: () => [
    wander({ speed: 1.2 }),
    chaseOnSight({ range: 4, noticeTime: 0.6, speed: 3 }),
    encounterOnTouch({ range: 0.9, enemy: "kobold-greatsword" }),
  ],
};
