import type { Entity, System, World } from "../../../core/ecs.js";
import type { Vec2 } from "../../../core/math.js";
import type { Equipment } from "../../../items/gear.js";
import {
  attackDamage, attackShape, attackSteps, ATTACKS, weaponIn, type AttackKind, type GuardSide, type Weapon,
} from "../../../weapons/weapons.js";
import { ActiveHit, Wielder, type SwingData, type WielderData } from "../../components.js";
import { FighterStats } from "../../stats.js";
import { addHit } from "../combat.js";

export const handsOf = (equipment: Equipment): WielderData["hands"] =>
  ({ rightHand: equipment.rightHand, leftHand: equipment.leftHand });

export const bladeLive = (swing: SwingData): boolean => swing.step >= swing.liveAt && swing.step < swing.liveUntil;

export function startSwing(
  world: World, e: Entity, weapon: Weapon, attack: AttackKind, side: GuardSide, chain: number, dir: Vec2, swift = 1,
): void {
  world.remove(e, ActiveHit);
  world.require(e, Wielder).swing = {
    attack, side, chain, dir, step: 0, ...attackSteps(weapon, attack, chain, swift),
    damage: attackDamage(weapon, attack, world.require(e, FighterStats).strength),
    poiseDamage: ATTACKS[attack].poiseDamage,
  };
}

export function endSwing(world: World, e: Entity): void {
  world.remove(e, ActiveHit);
  const wielder = world.get(e, Wielder);
  if (wielder) wielder.swing = null;
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
          ...attackShape(swing.side, wielder.armReachM, weapon), damage: swing.damage, poiseDamage: swing.poiseDamage,
          attack: swing.attack, side: swing.side,
        });
      }
      swing.step++;
    }
  };
}
