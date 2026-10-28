import type { Entity, System, World } from "../../../core/ecs.js";
import type { Equipment } from "../../../items/gear.js";
import {
  attackShape, CHAIN, chainKind, isSwing, lettingGoAt, liveStep, MOMENTUM, momentumDamage, startupTime, stepsUntil,
  weaponIn, type AttackKind, type Weapon,
} from "../../../weapons/weapons.js";
import { ActiveHit, Wielder, type SwingData, type WielderData } from "../../components.js";
import { addHit } from "../combat.js";

type SwingStart = Omit<SwingData, "step">;
type SwingHit = Pick<SwingData, "damage" | "knockback" | "lift" | "poiseDamage">;

export const handsOf = (equipment: Equipment): WielderData["hands"] =>
  ({ rightHand: equipment.rightHand, leftHand: equipment.leftHand });

export const bladeLive = (swing: SwingData): boolean => swing.step >= swing.liveAt && swing.step < swing.liveUntil;

export function startSwing(world: World, e: Entity, swing: SwingStart): void {
  world.remove(e, ActiveHit);
  world.require(e, Wielder).swing = { ...swing, step: 0 };
}

export function endSwing(world: World, e: Entity): void {
  world.remove(e, ActiveHit);
  const wielder = world.get(e, Wielder);
  if (wielder) wielder.swing = null;
}

/** The chain is broken (a gap, a block, a dodge, a hit taken, being parried): its momentum is gone. */
export function endChain(wielder: WielderData): void {
  wielder.combo = null;
  wielder.comboTime = 0;
  wielder.momentum = 0;
}

/** Returns the start (s) and damage factor. */
export function chainOn(
  wielder: WielderData, weapon: Weapon, attack: AttackKind, chained: boolean, stabFactor: number,
): { startup: number; power: number } {
  if (!chained) endChain(wielder);
  if (isSwing(attack)) {
    const kind = chainKind(wielder.combo, attack);
    wielder.momentum = Math.min(MOMENTUM.max, wielder.momentum + MOMENTUM.gain[kind]);
    wielder.combo = attack;
    return { startup: startupTime(kind, wielder.momentum, weapon.speed), power: momentumDamage(wielder.momentum) };
  }
  const power = stabFactor * (1 + wielder.momentum * MOMENTUM.stabBonusPerPoint);
  endChain(wielder);
  return { startup: CHAIN.stabStartupTime / weapon.speed, power };
}

export function chainedSwing(attack: AttackKind, dir: SwingData["dir"], startup: number, hit: SwingHit): SwingStart {
  const liveAt = liveStep(startup);
  return {
    attack, dir, liveAt, liveUntil: liveAt + liveStep(CHAIN.activeTime), letGoAt: stepsUntil(lettingGoAt(startup)),
    endAt: stepsUntil(startup + CHAIN.activeTime + CHAIN.recoverTime), ...hit,
  };
}

// Runs after the controllers and brains, which start and end swings.
export function weaponSystem(): System {
  return (world) => {
    for (const [e, wielder] of world.query(Wielder)) {
      const swing = wielder.swing, weapon = weaponIn(wielder.hands);
      if (!swing) continue;
      if (!weapon || swing.step >= swing.endAt) {
        endSwing(world, e);
        continue;
      }
      if (!bladeLive(swing)) world.remove(e, ActiveHit);
      else if (!world.has(e, ActiveHit)) {
        addHit(world, e, swing.dir.x, swing.dir.z, {
          ...attackShape(swing.attack, wielder.armReachM, weapon), damage: swing.damage, knockback: swing.knockback,
          lift: swing.lift, poiseDamage: swing.poiseDamage, attack: swing.attack,
        });
      }
      swing.step++;
    }
  };
}
