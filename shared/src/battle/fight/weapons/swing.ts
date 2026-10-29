import type { Entity, System, World } from "../../../core/ecs.js";
import type { Equipment } from "../../../items/gear.js";
import { attackShape, followingBlade, restingBlade, SWING, weaponIn, type Blade } from "../../../weapons/weapons.js";
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
  const letGo = wielder.swing.step >= wielder.swing.letGoAt;
  wielder.blade = letGo ? bladeOf(wielder.swing) : restingBlade();
  wielder.restTime = letGo ? SWING.gapTime : 0;
  wielder.swing = null;
}

function bladeOf(swing: SwingData): Blade {
  const left = Math.max(0, 1 - (swing.step - swing.letGoAt) / Math.max(1, swing.endAt - swing.letGoAt));
  return followingBlade(swing.attack, swing.flow * left);
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
          if (wielder.restTime <= 0) wielder.blade = { ...wielder.blade, vx: 0, vy: 0 };
        }
        continue;
      }
      if (!weapon || swing.step >= swing.endAt) {
        endSwing(world, e);
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
