import {
  attackSteps, CHAIN, sideOfWay, wayStepsAfter, WEAPONS, type AttackKind, type GuardSide, type SwingData, type Way,
} from "@infinite-tower/shared";

export function swingAt(attack: AttackKind, side: GuardSide, step: number, aimYaw = 0): SwingData {
  return {
    attack, side, way: null, chain: 0, dir: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) }, step,
    ...attackSteps(WEAPONS.sword, attack, 0), damage: 9, poiseDamage: 12, posture: 0, perilous: null,
  };
}

export function waySwingAt(way: Way, step: number): SwingData {
  return {
    attack: "light", side: sideOfWay(way), way, chain: 0, dir: { x: 0, z: 1 }, step,
    ...wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, false), damage: 9, poiseDamage: 12, posture: 0,
    perilous: null,
  };
}

export function swingSteps(attack: AttackKind, side: GuardSide, aimYaw = 0): SwingData[] {
  const out = [swingAt(attack, side, 0, aimYaw)];
  while (out.length < out[0]!.endAt) out.push(swingAt(attack, side, out.length, aimYaw));
  return out;
}
