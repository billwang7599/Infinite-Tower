import { BASE_STATS } from "@infinite-tower/shared";
import type { Enemy } from "./index.js";

export const TRAINING_DUMMY: Enemy = {
  def: {
    id: "training-dummy",
    name: "Training dummy",
    maxHp: 100,
    stats: { ...BASE_STATS, skillpower: 0, healthRegen: 0 },
    radius: 0.4,
    walkSpeed: 0,
    turnRate: 0,
    poise: 1000,
    poiseRegen: 1000,
    staggerTime: 0.5,
    attacks: {},
    dummy: true,
  },
  drops: [],
  treasure: {},
  overworld: () => [],
};
