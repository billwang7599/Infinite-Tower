import {
  liveStep, planSwing, restingBlade, stepsUntil, SWING, WEAPONS, type AttackKind, type SwingData,
} from "@infinite-tower/shared";

export function swingAt(attack: AttackKind, step: number, aimYaw = 0): SwingData {
  const plan = planSwing(WEAPONS.sword, 10, restingBlade(), attack);
  const liveAt = liveStep(plan.windupTime), active = SWING.activeTime * plan.timeFactor;
  return {
    attack, dir: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) }, step, driveAt: liveAt - liveStep(plan.driveTime),
    liveAt, liveUntil: liveAt + liveStep(active), letGoAt: stepsUntil(plan.windupTime + active),
    endAt: stepsUntil(plan.windupTime + active + plan.followTime), damage: 9, knockback: 0, lift: 0, poiseDamage: 12,
    momentum: plan.momentum, startSpeed: plan.startSpeed, flow: plan.flow, stoppedAt: null,
  };
}

export function swingSteps(attack: AttackKind, aimYaw = 0): SwingData[] {
  const out = [swingAt(attack, 0, aimYaw)];
  while (out.length < out[0]!.endAt) out.push(swingAt(attack, out.length, aimYaw));
  return out;
}
