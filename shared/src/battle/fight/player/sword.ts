import type { Entity, World } from "../../../core/ecs.js";
import { FIXED_DT } from "../../../core/time.js";
import { shotOf } from "../../../skills/effects.js";
import {
  CHAIN, chainKind, guardRaiseTime, HYBRID, lastFeintStep, perfectBlockTime, MOMENTUM, momentumDamage, strikeCost,
  windupTime, type ChainKind, type Strike, type Way,
} from "../../../weapons/hybrid.js";
import { meleeOf, rangedOf } from "../../../weapons/kinds.js";
import type { Guard, Weapon } from "../../../weapons/weapons.js";
import type { PlayerData, StaminaData, WielderData } from "../../components.js";
import type { PlayerInputData } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats } from "../../stats.js";
import type { FightEvent } from "../context.js";
import { imbueOf } from "../skills/cast.js";
import { canPayStamina, payStamina, spend } from "../combat.js";
import { modsOf } from "../../statuses.js";
import { endChain, endSwing, startWaySwing } from "../weapons/swing.js";
import { drawBow } from "./bow.js";
import { startAction } from "./controller.js";

export interface SwordTurn {
  world: World;
  e: Entity;
  dt: number;
  events: FightEvent[];
  player: PlayerData;
  input: PlayerInputData;
  wielder: WielderData;
  stamina: StaminaData;
  weapon: Weapon | null;
  guard: Guard | null;
  stunned: boolean;
  free: boolean;
}

const UNAIMED = "tb";

export function readSword(t: SwordTurn): void {
  const { player, input, wielder, guard, dt } = t, swing = wielder.swing;
  const locked = swing !== null && swing.step < swing.liveUntil;
  const attackPressed = t.weapon !== null && input.attack !== null && input.attack !== player.last.attack;
  player.way = meleeOf(t.weapon) ? input.way : null;
  if (attackPressed) {
    player.queued = input.attack;
    player.attackBuffer = PLAYER.inputBuffer;
  } else if (!locked) player.attackBuffer = Math.max(0, player.attackBuffer - dt);
  const blockPressed = input.block && !player.last.block;
  const feint = blockPressed && !t.stunned && player.action === "attack" && swing?.attack === "heavy"
    && swing.step <= lastFeintStep(swing.liveAt) && t.stamina.value > 0;
  if (blockPressed) {
    const strength = t.world.require(t.e, FighterStats).strength;
    player.perfectBlockLeft = guard && !feint && player.sinceBlockPress >= HYBRID.block.remashTime
      ? guardRaiseTime(guard, strength) + perfectBlockTime(guard) : 0;
    player.sinceBlockPress = 0;
  } else {
    player.perfectBlockLeft = Math.max(0, player.perfectBlockLeft - dt);
    player.sinceBlockPress += dt;
  }
  if (wielder.combo !== null) {
    wielder.comboTime -= dt;
    if (wielder.comboTime <= 0) endChain(wielder);
  }
  if (feint) {
    endSwing(t.world, t.e);
    endChain(wielder);
    spend(t.stamina, HYBRID.feint.cost);
    player.action = "none";
    player.attackBuffer = 0;
    t.events.push({ type: "feint", by: t.e });
  }
}

function strike(t: SwordTurn, strike: Strike): void {
  const { world, e, player, input, wielder, weapon } = t;
  if (!(wielder.combo !== null && wielder.comboTime > 0)) endChain(wielder);
  const way: Way = strike === "stab" ? "stab" : player.way ?? UNAIMED;
  let kind: ChainKind = "opening", power: number;
  if (way === "stab") {
    power = 1 + wielder.momentum * MOMENTUM.stabBonusPerPoint;
    endChain(wielder);
  } else {
    kind = chainKind(wielder.combo, way);
    wielder.momentum = Math.min(MOMENTUM.max, wielder.momentum + MOMENTUM.gain[kind]);
    wielder.combo = way;
    power = momentumDamage(wielder.momentum);
  }
  let windup = windupTime(strike, kind, wielder.momentum);
  const imbue = imbueOf(world, e)?.[1];
  if (imbue) windup /= shotOf(imbue.skill.segments[imbue.segment]!).swiftFactor;
  startAction(world, e, player, "attack", input.aimX, input.aimZ);
  startWaySwing(world, e, weapon!, strike, way, windup, power, { x: input.aimX, z: input.aimZ });
  if (wielder.combo !== null) wielder.comboTime = wielder.swing!.endAt * FIXED_DT + CHAIN.gapTime;
}

export function attackOrBlock(t: SwordTurn): boolean {
  const { world, e, player, input, wielder, stamina, weapon } = t, ranged = rangedOf(weapon);
  if (ranged && drawBow(t, ranged)) return true;
  const cost = meleeOf(weapon) && player.queued !== null
    ? strikeCost(weapon!, player.queued, world.require(e, FighterStats).strength) * modsOf(world, e).attackCostFactor
    : 0;
  if (t.free && meleeOf(weapon) && player.attackBuffer > 0 && player.queued !== null
    && canPayStamina(world, e, stamina, cost)) {
    strike(t, player.queued);
    payStamina(world, e, stamina, cost);
    player.attackBuffer = 0;
    return true;
  }
  if (player.action === "block" && !input.block) {
    player.action = "none";
    return true;
  }
  if (player.action !== "none" || !t.guard || !input.block || !player.grounded) return false;
  startAction(world, e, player, "block", input.aimX, input.aimZ);
  endChain(wielder);
  return true;
}
