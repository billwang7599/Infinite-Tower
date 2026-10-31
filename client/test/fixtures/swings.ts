import {
  CHAIN, HYBRID, wayStepsAfter, WEAPONS, type AttackKind, type SwingData, type Way,
} from "@infinite-tower/shared";

export function swingAt(attack: AttackKind, way: Way, step: number, aimYaw = 0): SwingData {
  const heavy = attack === "heavy", windup = CHAIN.startupTime.opening + (heavy ? HYBRID.heavy.extraTime : 0);
  return {
    attack, way, dir: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) }, step,
    ...wayStepsAfter(WEAPONS.sword, windup, heavy), damage: 9, poiseDamage: 12,
  };
}

export const waySwingAt = (way: Way, step: number): SwingData => swingAt("light", way, step);

export function swingSteps(attack: AttackKind, way: Way, aimYaw = 0): SwingData[] {
  const out = [swingAt(attack, way, 0, aimYaw)];
  while (out.length < out[0]!.endAt) out.push(swingAt(attack, way, out.length, aimYaw));
  return out;
}
