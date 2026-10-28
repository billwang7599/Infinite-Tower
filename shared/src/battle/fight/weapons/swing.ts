import type { Entity, System, World } from "../../../core/ecs.js";
import type { Equipment } from "../../../items/gear.js";
import { attackShape, restingBlade, SWING, weaponIn } from "../../../weapons/weapons.js";
import { ActiveHit, Wielder, type SwingData, type WielderData } from "../../components.js";
import { addHit } from "../combat.js";

export const handsOf = (equipment: Equipment): WielderData["hands"] =>
  ({ rightHand: equipment.rightHand, leftHand: equipment.leftHand });

export const bladeLive = (swing: SwingData): boolean => swing.step >= swing.liveAt && swing.step < swing.liveUntil;

export function startSwing(world: World, e: Entity, swing: Omit<SwingData, "step">): void {
  world.remove(e, ActiveHit);
  world.require(e, Wielder).swing = { ...swing, step: 0 };
}

export function endSwing(world: World, e: Entity): void {
  world.remove(e, ActiveHit);
  const wielder = world.get(e, Wielder);
  if (!wielder?.swing) return;
  if (wielder.swing.step < wielder.swing.letGoAt) restBlade(wielder);
  wielder.swing = null;
}

export function restBlade(wielder: WielderData): void {
  wielder.blade = restingBlade();
  wielder.restTime = 0;
}

// Runs after the controllers and brains, which start and end swings.
export function weaponSystem(): System {
  return (world, dt) => {
    for (const [e, wielder] of world.query(Wielder)) {
      const swing = wielder.swing, weapon = weaponIn(wielder.hands);
      if (!swing) {
        if (wielder.restTime > 0) {
          wielder.restTime -= dt;
          if (wielder.restTime <= 0) restBlade(wielder);
        }
        continue;
      }
      if (!weapon || swing.step >= swing.endAt) {
        endSwing(world, e);
        wielder.restTime = SWING.gapTime;
        continue;
      }
      if (!bladeLive(swing)) world.remove(e, ActiveHit);
      else if (!world.has(e, ActiveHit)) {
        addHit(world, e, swing.dir.x, swing.dir.z, {
          ...attackShape(swing.attack, wielder.armReachM, weapon), damage: swing.damage, knockback: swing.knockback,
          lift: swing.lift, poiseDamage: swing.poiseDamage, momentum: swing.momentum, attack: swing.attack,
        });
      }
      swing.step++;
    }
  };
}
