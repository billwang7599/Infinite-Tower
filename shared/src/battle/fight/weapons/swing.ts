import type { Entity, System, World } from "../../../core/ecs.js";
import type { Vec2 } from "../../../core/math.js";
import type { Equipment, Hand } from "../../../items/gear.js";
import { HYBRID, strikeDamage, strikeOf, type Strike, type Way } from "../../../weapons/hybrid.js";
import { meleeOf } from "../../../weapons/kinds.js";
import { weaponIn, type Weapon } from "../../../weapons/weapons.js";
import { ActiveHit, Wielder, type SwingData, type WielderData } from "../../components.js";
import { FighterStats } from "../../stats.js";
import { addHit } from "../combat.js";

export const handsOf = (equipment: Equipment, active: Hand = "rightHand"): WielderData["hands"] =>
  ({ rightHand: equipment.rightHand, leftHand: equipment.leftHand, active });

export const bladeLive = (swing: SwingData): boolean => swing.step >= swing.liveAt && swing.step < swing.liveUntil;


export function startWaySwing(
  world: World, e: Entity, weapon: Weapon, strike: Strike, way: Way, windupTime: number, power: number, dir: Vec2,
): void {
  const melee = meleeOf(weapon);
  world.remove(e, ActiveHit);
  if (!melee) return;
  const stats = world.require(e, FighterStats);
  world.require(e, Wielder).swing = {
    attack: strike === "heavy" ? "heavy" : "light", way, dir, step: 0,
    ...melee.steps(weapon, windupTime, strike === "heavy", stats.strength),
    damage: strikeDamage(weapon, strike, power, stats),
    poiseDamage: HYBRID[strike].poiseDamage,
  };
}

export function endChain(wielder: WielderData): void {
  wielder.combo = null;
  wielder.comboTime = 0;
  wielder.momentum = 0;
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
      const swing = wielder.swing, weapon = weaponIn(wielder.hands), melee = meleeOf(weapon);
      if (!swing) continue;
      if (!weapon || !melee || swing.step >= swing.endAt) {
        endSwing(world, e);
        continue;
      }
      if (!bladeLive(swing)) world.remove(e, ActiveHit);
      else if (!world.has(e, ActiveHit)) {
        addHit(world, e, swing.dir.x, swing.dir.z, {
          ...melee.shape(swing.way, wielder.armReachM, weapon), damage: swing.damage, poiseDamage: swing.poiseDamage,
          knockback: HYBRID[strikeOf(swing.attack, swing.way)].knockbackSpeed, attack: swing.attack, way: swing.way,
        });
      }
      swing.step++;
    }
  };
}
