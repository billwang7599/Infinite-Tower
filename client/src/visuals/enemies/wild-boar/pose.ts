import type { ChargeDef, EnemyState, LungeDef } from "@infinite-tower/shared";

/** Where the boar's parts head (the model eases toward them). headPitch > 0: nose down; lean > 0: front down. */
export interface BoarPose {
  headPitch: number;
  lean: number;
  roll: number;
  /** How quickly the roll eases (1/s). */
  rollRate: number;
  /** Shaking side to side (m). */
  tremble: number;
  yOff: number;
  zOff: number;
  /** The eyes' glow, 0..1. */
  glow: number;
  /** Legs held at an angle (rad) instead of walking: front-left, front-right, back-left, back-right. */
  legs: [number | null, number | null, number | null, number | null];
  stars: boolean;
  /** The charge's red line on the ground: its visibility, or null when hidden. */
  telegraph: number | null;
}

/** `state` is "dead" at 0 HP whatever the enemy's state says: its brain only notices on the step after the blow. */
export function boarPose(state: EnemyState, t: number, lunge?: LungeDef, charge?: ChargeDef): BoarPose {
  const p: BoarPose = {
    headPitch: 0, lean: 0, roll: 0, rollRate: 12, tremble: 0, yOff: 0, zOff: 0, glow: 0,
    legs: [null, null, null, null], stars: state === "stunned", telegraph: null,
  };
  switch (state) {
    case "lungeWindup": {
      const k = lunge ? Math.min(1, t / lunge.windup) : 1;
      Object.assign(p, { headPitch: 0.5 * k, zOff: -0.3 * k, lean: -0.1 * k, tremble: 0.015 * k });
      break;
    }
    case "lunge":
      Object.assign(p, { headPitch: -0.7, zOff: 0.25, lean: 0.1 });
      break;
    case "lungeRecover":
      p.headPitch = lunge ? -0.2 * (1 - t / lunge.recover) : 0;
      break;
    case "chargeWindup": {
      const k = charge ? Math.min(1, t / charge.windup) : 1;
      Object.assign(p, { headPitch: 0.4, lean: 0.12, tremble: 0.035 * k, glow: k });
      // Paw the ground with the front right hoof.
      p.legs[1] = -0.35 + Math.sin(t * 14) * 0.55;
      if (charge) p.telegraph = 0.2 + 0.8 * Math.min(1, t / (charge.windup - charge.lockAt));
      break;
    }
    case "charge":
      Object.assign(p, { headPitch: 0.35, lean: 0.15, glow: 1 });
      break;
    case "chargeRecover":
      Object.assign(p, { headPitch: 0.1, lean: charge ? -0.1 * (1 - t / charge.recover) : 0 });
      break;
    case "stunned":
      Object.assign(p, { headPitch: 0.55, roll: Math.sin(t * 5) * 0.12 });
      break;
    case "grabbed":
    case "staggered":
      Object.assign(p, { headPitch: -0.45, lean: -0.15, roll: Math.sin(t * 14) * 0.08 });
      break;
    case "dead":
      Object.assign(p, { roll: Math.PI / 2, yOff: 0.45, headPitch: 0.3, rollRate: 6, legs: [0.3, 0.3, 0.3, 0.3] });
      break;
  }
  return p;
}
