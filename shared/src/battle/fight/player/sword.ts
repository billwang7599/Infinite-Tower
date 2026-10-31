import type { Entity, World } from "../../../core/ecs.js";
import { FIXED_DT } from "../../../core/time.js";
import { shotOf } from "../../../skills/effects.js";
import {
  CHAIN, chainKind, HYBRID, MOMENTUM, momentumDamage, startupTime, strikeCost, type Strike, type Way,
} from "../../../weapons/hybrid.js";
import type { Weapon } from "../../../weapons/weapons.js";
import type { PlayerData, StaminaData, WielderData } from "../../components.js";
import type { PlayerInputData } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats } from "../../stats.js";
import type { FightEvent } from "../context.js";
import { imbueOf } from "../skills/cast.js";
import { spend } from "../combat.js";
import { endChain, startWaySwing } from "../weapons/swing.js";
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
  stunned: boolean;
  free: boolean;
}

const UNAIMED = "tb";

export function readSword(t: SwordTurn): void {
  const { player, input, wielder, weapon, dt } = t, swing = wielder.swing;
  const locked = swing !== null && swing.step < swing.liveUntil;
  const attackPressed = weapon !== null && input.attack !== null && input.attack !== player.attackHeld;
  player.way = weapon ? input.way : null;
  if (attackPressed) {
    player.queued = input.attack;
    player.attackBuffer = PLAYER.inputBuffer;
  } else if (!locked) player.attackBuffer = Math.max(0, player.attackBuffer - dt);
  if (input.block && !player.blockHeld) {
    player.perfectBlockLeft = player.sinceBlockPress >= HYBRID.block.remashTime ? HYBRID.block.perfectTime : 0;
    player.sinceBlockPress = 0;
  } else {
    player.perfectBlockLeft = Math.max(0, player.perfectBlockLeft - dt);
    player.sinceBlockPress += dt;
  }
  player.attackHeld = input.attack;
  player.blockHeld = input.block;
  if (wielder.combo !== null) {
    wielder.comboTime -= dt;
    if (wielder.comboTime <= 0) endChain(wielder);
  }
}

function strike(t: SwordTurn, strike: Strike): void {
  const { world, e, player, input, wielder, weapon } = t;
  if (!(wielder.combo !== null && wielder.comboTime > 0)) endChain(wielder);
  const way: Way = strike === "stab" ? "stab" : player.way ?? UNAIMED;
  let windup: number, power: number;
  if (way === "stab") {
    windup = CHAIN.stabStartupTime;
    power = 1 + wielder.momentum * MOMENTUM.stabBonusPerPoint;
    endChain(wielder);
  } else {
    const kind = chainKind(wielder.combo, way);
    wielder.momentum = Math.min(MOMENTUM.max, wielder.momentum + MOMENTUM.gain[kind]);
    wielder.combo = way;
    windup = startupTime(kind, wielder.momentum) + (strike === "heavy" ? HYBRID.heavy.extraTime : 0);
    power = momentumDamage(wielder.momentum);
  }
  const imbue = imbueOf(world, e)?.[1];
  if (imbue) windup /= shotOf(imbue.skill.segments[imbue.segment]!).swiftFactor;
  startAction(world, e, player, "attack", input.aimX, input.aimZ);
  startWaySwing(world, e, weapon!, strike, way, windup, power, { x: input.aimX, z: input.aimZ });
  if (wielder.combo !== null) wielder.comboTime = wielder.swing!.endAt * FIXED_DT + CHAIN.gapTime;
}

export function attackOrBlock(t: SwordTurn): boolean {
  const { world, e, player, input, wielder, stamina, weapon } = t;
  if (t.free && weapon && player.attackBuffer > 0 && player.queued !== null && stamina.value > 0) {
    strike(t, player.queued);
    spend(stamina, strikeCost(weapon, player.queued, world.require(e, FighterStats).strength));
    player.attackBuffer = 0;
    return true;
  }
  if (player.action === "block" && !input.block) {
    player.action = "none";
    return true;
  }
  if (player.action !== "none" || !weapon || !input.block || !player.grounded) return false;
  startAction(world, e, player, "block", input.aimX, input.aimZ);
  endChain(wielder);
  return true;
}
