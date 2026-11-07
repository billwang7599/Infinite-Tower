import { koboldVisual } from "../kobold-swordsman/animation.js";
import type { KoboldBuild } from "../kobold-swordsman/model.js";

export const GREATSWORD_BUILD: KoboldBuild = { bulk: 1.15, scales: "#566d5f", cloth: "#3a2a33", plated: true };
export const koboldGreatswordVisual = koboldVisual(GREATSWORD_BUILD);
