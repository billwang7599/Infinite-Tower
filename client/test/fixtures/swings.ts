import { attackSteps, WEAPONS, type AttackKind, type GuardSide, type SwingData } from "@infinite-tower/shared";

export function swingAt(attack: AttackKind, side: GuardSide, step: number, aimYaw = 0): SwingData {
  return {
    attack, side, chain: 0, dir: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) }, step,
    ...attackSteps(WEAPONS.sword, attack, 0), damage: 9, poiseDamage: 12,
  };
}

export function swingSteps(attack: AttackKind, side: GuardSide, aimYaw = 0): SwingData[] {
  const out = [swingAt(attack, side, 0, aimYaw)];
  while (out.length < out[0]!.endAt) out.push(swingAt(attack, side, out.length, aimYaw));
  return out;
}
