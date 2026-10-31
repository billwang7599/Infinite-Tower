import type { Entity, World } from "../../../../core/ecs.js";
import { toSteps } from "../../../../core/time.js";
import { shotOf } from "../../../../skills/effects.js";
import { moveOf, nextWindow, POSTURE, POSTURE_MOVES } from "../../../../weapons/posture.js";
import { Body, Fighter, Posture, Wielder, type SwingData } from "../../../components.js";
import { PLAYER } from "../../../player.js";
import { stagger } from "../../combat.js";
import { spend, startAction } from "../../player/controller.js";
import { imbueOf } from "../../skills/cast.js";
import { inReach } from "../../weapons/guard-break.js";
import { startPostureSwing } from "../../weapons/swing.js";
import type { Style, SwordTurn } from "../styles.js";
import { addPosture } from "./posture.js";

const ZANSHIN_STEPS = toSteps(POSTURE.zanshin.windowTime);
const ZANSHIN_CUT_STEPS = toSteps(POSTURE.zanshin.recoverCutTime);

const finishing = (swing: SwingData | null): boolean =>
  swing !== null && swing.chain + 1 >= POSTURE.stringLength && swing.step < swing.endAt;

function read(t: SwordTurn): void {
  const { player, input, wielder: { swing }, weapon, dt } = t;
  const locked = swing !== null && swing.step < swing.liveUntil;
  if (weapon && input.attack === "light" && input.attack !== player.attackHeld) {
    player.queued = "light";
    player.attackBuffer = PLAYER.inputBuffer;
  } else if (!locked && !finishing(swing)) player.attackBuffer = Math.max(0, player.attackBuffer - dt);
  if (weapon && input.perilous !== null && input.perilous !== player.perilousHeld) {
    player.perilousQueued = input.perilous;
    player.perilousBuffer = PLAYER.inputBuffer;
  } else if (!locked) player.perilousBuffer = Math.max(0, player.perilousBuffer - dt);
  if (input.block && !player.blockHeld) {
    player.deflectWindowSteps = nextWindow(player.deflectWindowSteps, player.sinceGuardReleaseSteps);
    player.sinceGuardPressSteps = 0;
    zanshin(t);
  } else player.sinceGuardPressSteps++;
  if (!input.block) player.sinceGuardReleaseSteps = player.blockHeld ? 0 : player.sinceGuardReleaseSteps + 1;
  player.attackHeld = input.attack;
  player.perilousHeld = input.perilous;
  player.blockHeld = input.block;
  if (t.stunned) player.perilousBuffer = 0;
}

function zanshin({ world, e, events, wielder: { swing } }: SwordTurn): void {
  const posture = world.get(e, Posture);
  if (!swing || !posture?.connected || swing.step < swing.liveUntil || swing.step - swing.liveUntil > ZANSHIN_STEPS) {
    return;
  }
  posture.connected = false;
  posture.value = Math.max(0, posture.value - POSTURE.zanshin.posture);
  swing.endAt = Math.max(swing.step, swing.endAt - ZANSHIN_CUT_STEPS);
  events.push({ type: "posture", by: e, target: e, what: "zanshin" });
}

const swiftOf = (world: World, e: Entity): number => {
  const imbue = imbueOf(world, e)?.[1];
  return imbue ? shotOf(imbue.skill.segments[imbue.segment]!).swiftFactor : 1;
};

function perilous(t: SwordTurn): boolean {
  const { world, e, player, input, stamina, weapon } = t, kind = player.perilousQueued;
  if (!t.free || !weapon || kind === null || player.perilousBuffer <= 0 || !player.grounded || stamina.value <= 0) {
    return false;
  }
  startAction(world, e, player, "attack", input.aimX, input.aimZ);
  const windup = POSTURE_MOVES[kind].windupTime / swiftOf(world, e);
  startPostureSwing(world, e, weapon, kind, 0, { x: input.aimX, z: input.aimZ }, windup);
  spend(stamina, POSTURE_MOVES[kind].cost);
  player.perilousBuffer = 0;
  return true;
}

function sweeperNear(world: World, e: Entity): Entity | null {
  const side = world.require(e, Fighter).side;
  for (const [other, fighter, wielder] of world.query(Fighter, Wielder)) {
    if (fighter.side !== side && wielder.swing?.perilous === "sweep" && inReach(world, e, other, POSTURE.jumpKick)) {
      return other;
    }
  }
  return null;
}

function jumpKick({ world, e, events, player }: SwordTurn): boolean {
  const target = sweeperNear(world, e);
  if (target === null) return false;
  stagger(world, target, POSTURE.jumpKick.staggerTime);
  addPosture(world, events, target, POSTURE.jumpKick.posture, e);
  world.require(e, Body).vel.y = POSTURE.jumpKick.bounceSpeed;
  player.attackBuffer = 0;
  events.push({ type: "posture", by: e, target, what: "jumpKick" });
  return true;
}

function swingOrGuard(t: SwordTurn): boolean {
  const { world, e, player, input, wielder, weapon } = t;
  if (t.free && weapon && player.attackBuffer > 0 && player.queued === "light" && !finishing(wielder.swing)) {
    if (!player.grounded && jumpKick(t)) return true;
    const last = wielder.swing, chained = last !== null && last.step >= last.liveUntil && last.step < last.endAt;
    const chain = chained ? last.chain + 1 : 0, move = moveOf(chain);
    const windup = move === "finisher" ? POSTURE_MOVES.finisher.windupTime
      : chain > 0 ? POSTURE.chainWindupTime : POSTURE_MOVES.swing.windupTime;
    startAction(world, e, player, "attack", input.aimX, input.aimZ);
    startPostureSwing(world, e, weapon, move, chain, { x: input.aimX, z: input.aimZ }, windup / swiftOf(world, e));
    player.attackBuffer = 0;
    return true;
  }
  if (player.action === "block" && !input.block) {
    player.action = "none";
    return true;
  }
  if (player.action !== "none" || !weapon || !input.block || !player.grounded) return false;
  startAction(world, e, player, "block", input.aimX, input.aimZ);
  return true;
}

export const POSTURE_PLAYER: Pick<Style, "read" | "first" | "last"> = { read, first: perilous, last: swingOrGuard };
