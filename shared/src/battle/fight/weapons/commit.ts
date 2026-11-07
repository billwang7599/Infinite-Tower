import type { Entity, System, World } from "../../../core/ecs.js";
import { turnToward, type Vec2 } from "../../../core/math.js";
import { FIXED_DT, toSteps } from "../../../core/time.js";
import { HYBRID } from "../../../weapons/hybrid.js";
import { feltHeft, weaponIn } from "../../../weapons/weapons.js";
import { ActiveHit, Wielder, type SwingData, type WielderData } from "../../components.js";
import { FighterStats } from "../../stats.js";
import type { FightEvent } from "../context.js";
import { bladeLive, endChain, endSwing } from "./swing.js";

const { swinging } = HYBRID;

function heftOf(world: World, e: Entity): number {
  const weapon = weaponIn(world.require(e, Wielder).hands);
  return weapon ? feltHeft(weapon, world.require(e, FighterStats).strength) : 1;
}

export const committed = (swing: SwingData): boolean => swing.step < (swing.whiffed ? swing.endAt : swing.liveUntil);

export const canSwing = (wielder: WielderData): boolean => wielder.feintRecoverSteps === 0;

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
  const wielder = world.require(e, Wielder);
  wielder.feintRecoverSteps = toSteps(HYBRID.feint.recoverTime * heftOf(world, e));
  endSwing(world, e);
  endChain(wielder);
  events.push({ type: "feint", by: e });
}

// Runs after the hits, so a blade's last live step has met whoever it would.
export function commitSystem(): System {
  return (world) => {
    for (const [e, wielder] of world.query(Wielder)) {
      wielder.feintRecoverSteps = Math.max(0, wielder.feintRecoverSteps - 1);
      const swing = wielder.swing, hit = world.get(e, ActiveHit);
      if (!swing || swing.whiffed || swing.step !== swing.liveUntil || !hit || hit.alreadyHit.size > 0) continue;
      const steps = toSteps(swinging.whiffRecoverTime * heftOf(world, e));
      swing.whiffed = true;
      swing.endAt += steps;
      if (wielder.combo !== null) wielder.comboTime += steps * FIXED_DT;
    }
  };
}
