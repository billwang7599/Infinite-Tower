import { koboldVisual } from "../kobold-swordsman/animation.js";
import type { KoboldBuild } from "../kobold-swordsman/model.js";

export const SHIELDBEARER_BUILD: KoboldBuild = { bulk: 1.05, scales: "#6b7f4e", cloth: "#2f4466", plated: false };
export const koboldShieldbearerVisual = koboldVisual(SHIELDBEARER_BUILD);
