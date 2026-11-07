import { clamp } from "@infinite-tower/shared";

const DEG = Math.PI / 180;

export const STUN_CUE = {
  fullStrengthTime: 1, minStrength: 0.35, newStunRiseTime: 0.05, fadeInTime: 0.06, fadeOutTime: 0.25,
  kickPeakTime: 0.07, kickRollRad: 3 * DEG, kickPitchRad: 1.5 * DEG, swayRollRad: 1 * DEG, swayHz: 1.2,
};

export interface Stun {
  left: number;
  of: number;
  age: number;
  side: number;
  strength: number;
  shown: number;
  rollRad: number;
  pitchRad: number;
}

export const noStun = (): Stun =>
  ({ left: 0, of: 0, age: 0, side: 1, strength: 0, shown: 0, rollRad: 0, pitchRad: 0 });

export function followStun(stun: Stun, hitstun: number, dt: number): void {
  const C = STUN_CUE;
  if (hitstun > 0 && (stun.left <= 0 || hitstun > stun.left + C.newStunRiseTime)) {
    Object.assign(stun, { of: hitstun, age: 0, side: -stun.side });
  } else {
    stun.of = Math.max(stun.of, hitstun);
    stun.age += dt;
  }
  stun.left = hitstun;
  stun.strength = stun.of > 0 ? clamp(stun.of / C.fullStrengthTime, C.minStrength, 1) : 0;
  const fadeOutTime = Math.min(C.fadeOutTime, stun.of / 2);
  stun.shown = hitstun > 0 ? Math.min(1, stun.age / C.fadeInTime, hitstun / fadeOutTime) : 0;
  const kick = (stun.age / C.kickPeakTime) * Math.exp(1 - stun.age / C.kickPeakTime);
  const sway = Math.sin(2 * Math.PI * C.swayHz * stun.age), felt = stun.strength * stun.shown;
  stun.rollRad = stun.side * felt * (C.kickRollRad * kick + C.swayRollRad * sway);
  stun.pitchRad = felt * C.kickPitchRad * kick;
}
