import { shotOf } from "../../../../skills/effects.js";
import { cutCost, cutWindupTime, MASTER_CUTS } from "../../../../weapons/master-cuts.js";
import { Cuts, type SwingData } from "../../../components.js";
import { PLAYER } from "../../../player.js";
import { spend, startAction } from "../../player/controller.js";
import { imbueOf } from "../../skills/cast.js";
import { FOR_HONOR } from "../for-honor.js";
import type { Style, SwordTurn } from "../styles.js";
import { fehler, fehlerable, guardOf, swingFrom } from "./guard.js";

const chainSpent = (swing: SwingData | null): boolean =>
  swing !== null && swing.chain + 1 >= MASTER_CUTS.strike.maxChain && swing.step < swing.endAt;

function read(t: SwordTurn): void {
  const { world, e, events, player, input, wielder: { swing }, weapon, dt } = t;
  const cuts = world.require(e, Cuts);
  const waiting = (swing !== null && swing.step < swing.liveUntil) || cuts.moveSteps > 0 || chainSpent(swing);
  if (weapon && (input.attack === "light" || input.attack === "heavy") && input.attack !== player.attackHeld) {
    player.queued = input.attack;
    player.attackBuffer = t.stamina.value > 0 ? PLAYER.inputBuffer : 0;
  } else if (!waiting) player.attackBuffer = Math.max(0, player.attackBuffer - dt);
  const guardBreakPressed = input.guardBreak && !player.guardBreakHeld;
  if (guardBreakPressed) player.guardBreakBuffer = PLAYER.inputBuffer;
  else player.guardBreakBuffer = Math.max(0, player.guardBreakBuffer - dt);
  player.attackHeld = input.attack;
  player.guardBreakHeld = input.guardBreak;
  if (t.stunned) player.guardBreakBuffer = player.action === "grabbed" && guardBreakPressed ? PLAYER.inputBuffer : 0;
  if (!input.stance || input.stance === cuts.want) return;
  cuts.want = input.stance;
  if (!t.stunned && player.action === "attack" && fehlerable(world, e, swing)) fehler(world, events, e, swing, cuts.want);
}

function attack(t: SwordTurn): boolean {
  const { world, e, player, input, wielder: { swing: last }, stamina, weapon } = t, queued = player.queued;
  const stance = guardOf(world, e);
  if (!t.free || !weapon || stance === null || chainSpent(last) || player.attackBuffer <= 0
    || (queued !== "light" && queued !== "heavy") || stamina.value <= 0) return false;
  const move = queued === "heavy" ? "cut" : "strike";
  const chained = move === "strike" && last !== null && last.attack === "light" && last.step < last.endAt;
  const chain = chained ? last.chain + 1 : 0;
  const imbue = imbueOf(world, e)?.[1];
  const swift = imbue ? shotOf(imbue.skill.segments[imbue.segment]!).swiftFactor : 1;
  startAction(world, e, player, "attack", input.aimX, input.aimZ);
  swingFrom(world, e, weapon, move, chain, { x: input.aimX, z: input.aimZ }, cutWindupTime(move, stance, chain) / swift);
  spend(stamina, cutCost(weapon, move));
  player.attackBuffer = 0;
  return true;
}

export const MASTER_CUTS_PLAYER: Pick<Style, "read" | "first" | "last"> = { read, first: FOR_HONOR.first, last: attack };
