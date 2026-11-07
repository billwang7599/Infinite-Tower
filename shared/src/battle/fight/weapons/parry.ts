import type { Entity, World } from "../../../core/ecs.js";
import { toSteps } from "../../../core/time.js";
import {
  HYBRID, parryKind, parryRecoilTime, parryWindowTime, swingWeight, type ParryKind,
} from "../../../weapons/hybrid.js";
import { weaponIn } from "../../../weapons/weapons.js";
import { Body, Enemy, WeaponAttack, Wielder, type ActiveHitData } from "../../components.js";
import { FighterStats } from "../../stats.js";
import { enter } from "../behaviors/common.js";
import { faces, stagger } from "../combat.js";
import type { FightEvent } from "../context.js";
import { endChain, endSwing } from "./swing.js";

const CLASH_STEPS = toSteps(HYBRID.parry.clashTime);
const baseTime = (kind: ParryKind) => kind === "full" ? HYBRID.parry.fullRecoilTime : HYBRID.parry.partialRecoilTime;

function weightOf(world: World, e: Entity): number {
  const wielder = world.require(e, Wielder);
  return swingWeight(weaponIn(wielder.hands)!, world.require(e, FighterStats).strength, wielder.swing?.attack === "heavy");
}

const windowSteps = (world: World, e: Entity) => toSteps(parryWindowTime(weaponIn(world.require(e, Wielder).hands)!));

function recoil(world: World, e: Entity, time: number): void {
  endChain(world.require(e, Wielder));
  stagger(world, e, time);
}

function deflected(world: World, events: FightEvent[], parrier: Entity, parried: Entity, kind: ParryKind): void {
  const ratio = weightOf(world, parrier) / weightOf(world, parried);
  recoil(world, parried, parryRecoilTime(baseTime(kind), ratio));
  const enemy = world.get(parrier, Enemy), attack = world.get(parrier, WeaponAttack);
  if (enemy && attack) {
    enter(world, parrier, enemy, "approach");
    Object.assign(attack, { riposte: true, swingsLeft: 0 });
  } else endSwing(world, parrier);
  events.push({ type: "parry", by: parrier, target: parried, clash: false });
}

// Whichever blade went live first meets the other; within CLASH_STEPS of each other they clash.
export function parries(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): boolean {
  const theirs = world.get(attacker, Wielder)?.swing, mine = world.get(target, Wielder)?.swing;
  if (!theirs || !mine || hit.way === null) return false;
  const kind = parryKind(mine.way, hit.way);
  if (!kind) return false;
  if (!faces(world.require(target, Body).pos, mine.dir, world.require(attacker, Body).pos, HYBRID.block.minDot)) {
    return false;
  }
  // The weapon system has run this step, so the swing's clock is one on.
  const sinceLive = mine.step - 1 - mine.liveAt;
  if (Math.abs(sinceLive) <= CLASH_STEPS) {
    recoil(world, attacker, baseTime(kind));
    recoil(world, target, baseTime(kind));
    events.push({ type: "parry", by: target, target: attacker, clash: true });
  } else if (sinceLive > 0 && sinceLive <= windowSteps(world, target)) deflected(world, events, target, attacker, kind);
  else if (sinceLive < 0 && -sinceLive <= windowSteps(world, attacker)) deflected(world, events, attacker, target, kind);
  else return false;
  return true;
}
