import { FIXED_DT } from "../../../../core/time.js";
import { shotOf } from "../../../../skills/effects.js";
import {
  CHAIN, chainKind, HYBRID, MOMENTUM, momentumDamage, startupTime, strikeCost, type Strike, type Way,
} from "../../../../weapons/hybrid.js";
import { FEINT } from "../../../../weapons/weapons.js";
import { PLAYER } from "../../../player.js";
import { spend, startAction } from "../../player/controller.js";
import { imbueOf } from "../../skills/cast.js";
import { endChain, endSwing, lastFeintStep, startWaySwing } from "../../weapons/swing.js";
import type { Style, SwordTurn } from "../styles.js";

const UNAIMED = "tb";

function read(t: SwordTurn): void {
  const { player, input, wielder, weapon, dt } = t, swing = wielder.swing;
  const locked = swing !== null && swing.step < swing.liveUntil;
  const attackPressed = weapon !== null && input.attack !== null && input.attack !== player.attackHeld;
  const kickPressed = input.kick && !player.kickHeld;
  const feint = kickPressed && player.action === "attack" && swing !== null && swing.step <= lastFeintStep(swing);
  player.way = weapon ? input.way : null;
  if (attackPressed) {
    player.queued = input.attack;
    player.attackBuffer = PLAYER.inputBuffer;
  } else if (!locked) player.attackBuffer = Math.max(0, player.attackBuffer - dt);
  if (kickPressed && !feint) player.kickBuffer = PLAYER.inputBuffer;
  else if (!locked) player.kickBuffer = Math.max(0, player.kickBuffer - dt);
  if (input.block && !player.blockHeld) {
    player.tapParryLeft = player.sinceBlockPress >= HYBRID.block.retapTime ? HYBRID.block.tapParryTime : 0;
    player.sinceBlockPress = 0;
  } else {
    player.tapParryLeft = Math.max(0, player.tapParryLeft - dt);
    player.sinceBlockPress += dt;
  }
  player.attackHeld = input.attack;
  player.kickHeld = input.kick;
  player.blockHeld = input.block;
  if (wielder.combo !== null) {
    wielder.comboTime -= dt;
    if (wielder.comboTime <= 0) endChain(wielder);
  }
  if (t.stunned) player.kickBuffer = 0;
  else if (feint) {
    endSwing(t.world, t.e);
    spend(t.stamina, FEINT.cost);
    player.action = "none";
    t.events.push({ type: "feint", by: t.e });
  }
}

function kick({ world, e, player, input, wielder, stamina, free }: SwordTurn): boolean {
  if (!free || player.kickBuffer <= 0 || !player.grounded || stamina.value <= 0) return false;
  startAction(world, e, player, "kick", input.aimX, input.aimZ);
  wielder.kick = { step: 0 };
  spend(stamina, HYBRID.kick.cost);
  player.kickBuffer = 0;
  return true;
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

function attackOrBlock(t: SwordTurn): boolean {
  const { world, e, player, input, wielder, stamina, weapon } = t;
  if (t.free && weapon && player.attackBuffer > 0 && player.queued !== null && stamina.value > 0) {
    strike(t, player.queued);
    spend(stamina, strikeCost(weapon, player.queued));
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

export const HYBRID_PLAYER: Pick<Style, "read" | "first" | "last"> = { read, first: kick, last: attackOrBlock };
