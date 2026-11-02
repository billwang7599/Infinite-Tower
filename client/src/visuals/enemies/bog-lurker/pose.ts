import type { EnemyState, SlamDef } from "@infinite-tower/shared";

/** lean > 0: front down. */
export interface LurkerPose {
  /** Down into the bog (m). */
  sink: number;
  lean: number;
  roll: number;
  /** Forelimbs raised (rad) from hanging down. */
  arms: number;
  headPitch: number;
  jaw: number;
  /** Turned about its middle (rad); the sweep's whole circle is set, not eased. */
  spin: number;
  /** Shaking side to side (m). */
  tremble: number;
  /** The eyes' glow, 0..1. */
  glow: number;
}

const LOW_M = 0.45;

/** `state` is "dead" at 0 HP whatever the enemy's state says: its brain only notices on the step after the blow. */
export function lurkerPose(state: EnemyState, t: number, slam?: SlamDef): LurkerPose {
  const p: LurkerPose = { sink: LOW_M, lean: 0, roll: 0, arms: 0, headPitch: 0, jaw: 0, spin: 0, tremble: 0, glow: 0 };
  switch (state) {
    case "slamWindup": {
      const windup = slam?.windup ?? 1, lockAt = slam?.lockAt ?? 0, k = Math.min(1, t / (windup - lockAt));
      Object.assign(p, {
        sink: LOW_M * (1 - k), lean: -0.45 * k, arms: 1.6 * k, headPitch: -0.3 * k, jaw: 0.5 * k, glow: k,
        tremble: t >= windup - lockAt ? 0 : 0.02 * k,
      });
      break;
    }
    case "slam":
      Object.assign(p, { sink: 0.1, lean: 0.35, arms: -0.3, headPitch: 0.25, jaw: 0.2, glow: 1 });
      break;
    case "slamRecover":
      Object.assign(p, { sink: 0.15, lean: 0.25, arms: -0.2, headPitch: 0.3 });
      break;
    case "sweepWindup": {
      const k = Math.min(1, t / (slam?.sweep.windup ?? 1));
      Object.assign(p, { sink: LOW_M * (1 - k * 0.7), spin: -0.7 * k, glow: k, jaw: 0.3 * k, tremble: 0.015 * k });
      break;
    }
    case "sweep": {
      const k = Math.min(1, t / (slam?.sweep.active ?? 1));
      Object.assign(p, { sink: 0.1, spin: -0.7 + (2 * Math.PI + 0.7) * k, glow: 1 });
      break;
    }
    case "sweepRecover":
      Object.assign(p, { sink: 0.2, lean: 0.1 });
      break;
    case "stunned":
    case "staggered":
      Object.assign(p, { sink: 0.2, lean: -0.15, roll: Math.sin(t * 9) * 0.12, headPitch: -0.3, jaw: 0.4 });
      break;
    case "dead":
      Object.assign(p, { sink: LOW_M + 0.3, roll: Math.PI / 2, jaw: 0.4 });
      break;
  }
  return p;
}
