import {
  BASE_STATS, strikeDamage, wayStepsAfter, WEAPONS, windupTime, type AttackKind, type SwingData, type Way,
} from "@infinite-tower/shared";

export function swingAt(attack: AttackKind, way: Way, step: number, aimYaw = 0): SwingData {
  const heavy = attack === "heavy", windup = windupTime(attack, "opening");
  return {
    attack, way, dir: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) }, step,
    ...wayStepsAfter(WEAPONS.sword, windup, heavy),
    damage: strikeDamage(WEAPONS.sword, attack, 1, BASE_STATS), poiseDamage: 12,
    whiffed: false, hand: "rightHand",
  };
}

export const waySwingAt = (way: Way, step: number): SwingData => swingAt("light", way, step);

export function swingSteps(attack: AttackKind, way: Way, aimYaw = 0): SwingData[] {
  const out = [swingAt(attack, way, 0, aimYaw)];
  while (out.length < out[0]!.endAt) out.push(swingAt(attack, way, out.length, aimYaw));
  return out;
}
