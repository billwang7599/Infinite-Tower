import type { EnemyState, PounceDef } from "@infinite-tower/shared";

/** Where the wolf's parts head (the model eases toward them). headPitch > 0: nose down; lean > 0: front down. */
export interface WolfPose {
  headPitch: number;
  /** How far its jaw hangs open (rad). */
  jaw: number;
  /** Down toward the ground (m). */
  crouch: number;
  /** Up off the ground (m), not eased: a leap's arc. */
  lift: number;
  lean: number;
  roll: number;
  rollRate: number;
  /** Shaking side to side (m). */
  tremble: number;
  zOff: number;
  /** Raised (rad) from hanging down. */
  tail: number;
  /** The eyes' glow, 0..1. */
  glow: number;
  /** Legs held at an angle (rad) instead of walking: front-left, front-right, back-left, back-right. */
  legs: [number | null, number | null, number | null, number | null];
}

const arc = (t: number, of: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t / of)));

/** `state` is "dead" at 0 HP whatever the enemy's state says: its brain only notices on the step after the blow. */
export function wolfPose(state: EnemyState, t: number, pounce?: PounceDef): WolfPose {
  const p: WolfPose = {
    headPitch: 0, jaw: 0, crouch: 0, lift: 0, lean: 0, roll: 0, rollRate: 12, tremble: 0, zOff: 0, tail: 0.6, glow: 0,
    legs: [null, null, null, null],
  };
  switch (state) {
    case "pounceWindup": {
      const windup = pounce?.windup ?? 1, lockAt = pounce?.lockAt ?? 0, k = Math.min(1, t / (windup - lockAt));
      const locked = t >= windup - lockAt;
      Object.assign(p, {
        headPitch: 0.35 * k, crouch: 0.3 * k, lean: -0.12 * k, zOff: -0.2 * k, tail: 0.9, glow: k,
        jaw: 0.25 * k, tremble: locked ? 0 : 0.012 * k,
      });
      p.legs = [-0.5 * k, -0.5 * k, 0.6 * k, 0.6 * k];
      break;
    }
    case "pounce": {
      const k = pounce ? t / pounce.active : 1;
      Object.assign(p, {
        headPitch: -0.25, jaw: k < 0.7 ? 0.7 : 0.1, lift: 0.6 * arc(t, pounce?.active ?? 1), lean: -0.15 + 0.3 * k,
        zOff: 0.25, tail: 1.1, glow: 1,
      });
      p.legs = [-1, -1, 1, 1];
      break;
    }
    case "pounceRecover":
      Object.assign(p, { headPitch: 0.25, crouch: 0.08, tail: 0.4 });
      break;
    case "pounceHop":
      Object.assign(p, { lift: 0.3 * arc(t, pounce?.hopTime ?? 1), lean: -0.1, tail: 0.8 });
      p.legs = [0.6, 0.6, -0.4, -0.4];
      break;
    case "stunned":
    case "staggered":
      Object.assign(p, { headPitch: -0.4, lean: -0.15, roll: Math.sin(t * 14) * 0.1, tail: 0, jaw: 0.3 });
      break;
    case "dead":
      Object.assign(p, { roll: Math.PI / 2, crouch: -0.3, headPitch: 0.2, rollRate: 6, tail: 0, jaw: 0.3 });
      p.legs = [0.3, 0.3, 0.3, 0.3];
      break;
  }
  return p;
}
