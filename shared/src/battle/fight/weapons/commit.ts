import type { Entity, System, World } from "../../../core/ecs.js";
import { turnToward, type Vec2 } from "../../../core/math.js";
import { FIXED_DT, toSteps } from "../../../core/time.js";
import { HYBRID, weaponTime } from "../../../weapons/hybrid.js";
import type { Hand } from "../../../items/gear.js";
import { isMelee, isWeapon, weaponHandIn, WEAPONS } from "../../../weapons/weapons.js";
import { ActiveHit, Wielder, type SwingData, type WielderData } from "../../components.js";
import type { FightEvent } from "../context.js";
import { bladeLive, endChain, endSwing, strengthIn } from "./swing.js";

const { swinging } = HYBRID;

/** The weapon in `hand`'s whiff or feint recovery, at its wielder's grip strength. */
function recoverTimeOf(world: World, e: Entity, hand: Hand, time: "whiffRecoverTime" | "feintRecoverTime"): number {
  const item = world.require(e, Wielder).hands[hand], weapon = isWeapon(item) ? WEAPONS[item] : null;
  return isMelee(weapon) ? weaponTime(weapon, time, strengthIn(world, e)) : 0;
}

export const committed = (swing: SwingData): boolean => swing.step < (swing.whiffed ? swing.endAt : swing.liveUntil);

export function canSwing(wielder: WielderData): boolean {
  const hand = weaponHandIn(wielder.hands), swing = wielder.swing;
  if (hand === null) return true;
  return wielder.chains[hand].recoverSteps === 0 && !(swing?.hand === hand && swing.step < swing.endAt);
}

export function carrySpeed(swing: SwingData): number | null {
  if (bladeLive(swing)) return swinging.lungeSpeed;
  return swing.whiffed && swing.step < swing.endAt ? swinging.whiffCarrySpeed : null;
}

export function steer(world: World, e: Entity, swing: SwingData, want: Vec2, dt: number): void {
  if (!bladeLive(swing)) return;
  const yaw = turnToward(
    Math.atan2(swing.dir.x, swing.dir.z), Math.atan2(want.x, want.z), swinging.liveTurnRadPerSec * dt);
  swing.dir = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const hit = world.get(e, ActiveHit);
  if (hit) Object.assign(hit, { dirX: swing.dir.x, dirZ: swing.dir.z });
}

export function feint(world: World, e: Entity, events: FightEvent[]): void {
  const wielder = world.require(e, Wielder), swing = wielder.swing;
  if (swing) {
    wielder.chains[swing.hand].recoverSteps = toSteps(recoverTimeOf(world, e, swing.hand, "feintRecoverTime"));
  }
  endSwing(world, e);
  endChain(wielder);
  events.push({ type: "feint", by: e });
}

// Runs after the hits, so a blade's last live step has met whoever it would.
export function commitSystem(): System {
  return (world) => {
    for (const [e, wielder] of world.query(Wielder)) {
      for (const chain of Object.values(wielder.chains)) chain.recoverSteps = Math.max(0, chain.recoverSteps - 1);
      const swing = wielder.swing, hit = world.get(e, ActiveHit);
      if (!swing || swing.whiffed || swing.step !== swing.liveUntil || !hit || hit.alreadyHit.size > 0) continue;
      const steps = toSteps(recoverTimeOf(world, e, swing.hand, "whiffRecoverTime"));
      swing.whiffed = true;
      swing.endAt += steps;
      if (wielder.comboTime > 0) wielder.comboTime += steps * FIXED_DT;
    }
  };
}
