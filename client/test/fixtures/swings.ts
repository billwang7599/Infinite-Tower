import { liveStep, stepsUntil, SWING, type AttackKind, type SwingData } from "@infinite-tower/shared";

export const STARTUP = SWING.openingTime;

export function swingAt(attack: AttackKind, step: number, aimYaw = 0): SwingData {
  const liveAt = liveStep(STARTUP);
  return {
    attack, dir: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) }, step, liveAt,
    liveUntil: liveAt + liveStep(SWING.activeTime), letGoAt: stepsUntil(STARTUP + SWING.activeTime),
    endAt: stepsUntil(STARTUP + SWING.activeTime + SWING.recoverTime),
    damage: 9, knockback: 0, lift: 0, poiseDamage: 12, momentum: 1, flow: 1,
  };
}

export function swingSteps(attack: AttackKind, aimYaw = 0): SwingData[] {
  const out = [swingAt(attack, 0, aimYaw)];
  while (out.length < out[0]!.endAt) out.push(swingAt(attack, out.length, aimYaw));
  return out;
}
