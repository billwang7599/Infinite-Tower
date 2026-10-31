import type { Entity, System, World } from "../../../../core/ecs.js";
import type { Vec2 } from "../../../../core/math.js";
import { toSteps } from "../../../../core/time.js";
import {
  cutDamage, guardMoveSteps, MASTER_CUTS, type CutMove, type Stance,
} from "../../../../weapons/master-cuts.js";
import { weaponIn, type Weapon } from "../../../../weapons/weapons.js";
import { Cuts, Player, Stamina, Wielder, type SwingData } from "../../../components.js";
import { FighterStats } from "../../../stats.js";
import type { FightEvent } from "../../context.js";
import { spend } from "../../player/controller.js";
import { guardBreakSystem } from "../../weapons/guard-break.js";
import { startCutSwing } from "../../weapons/swing.js";

const CUTOFF_STEPS = toSteps(MASTER_CUTS.fehler.cutoffTime);

export function spawnCuts(world: World, e: Entity): void {
  if (!world.has(e, Wielder)) return;
  const stance = MASTER_CUTS.startStance;
  world.add(e, Cuts, { to: stance, want: stance, moveSteps: 0, fehlered: false });
}

export function guardOf(world: World, e: Entity): Stance | null {
  const cuts = world.get(e, Cuts), hands = world.get(e, Wielder)?.hands;
  return cuts && hands && weaponIn(hands) && cuts.moveSteps === 0 ? cuts.to : null;
}

export function swingFrom(
  world: World, e: Entity, weapon: Weapon, move: CutMove, chain: number, dir: Vec2, windupTime: number,
): void {
  const cuts = world.require(e, Cuts);
  cuts.fehlered = false;
  startCutSwing(world, e, weapon, move, cuts.to, chain, dir, windupTime);
}

export const fehlerable = (world: World, e: Entity, swing: SwingData | null): swing is SwingData =>
  swing !== null && swing.stance !== null && !world.require(e, Cuts).fehlered
  && swing.liveAt - swing.step > CUTOFF_STEPS;

export function fehler(world: World, events: FightEvent[], e: Entity, swing: SwingData, stance: Stance): void {
  const weapon = weaponIn(world.require(e, Wielder).hands)!, f = MASTER_CUTS.fehler;
  const shift = Math.max(0, swing.step + toSteps(f.minWindupTime * weapon.heft) - swing.liveAt);
  const move: CutMove = swing.attack === "heavy" ? "cut" : "strike";
  Object.assign(swing, {
    stance, liveAt: swing.liveAt + shift, liveUntil: swing.liveUntil + shift, endAt: swing.endAt + shift,
    damage: cutDamage(weapon, move, stance, world.require(e, FighterStats)),
  });
  Object.assign(world.require(e, Cuts), { to: stance, want: stance, moveSteps: 0, fehlered: true });
  const stamina = world.get(e, Stamina);
  if (stamina) spend(stamina, f.cost);
  events.push({ type: "feint", by: e });
}

function guardSystem(): System {
  return (world) => {
    for (const [e, cuts, wielder] of world.query(Cuts, Wielder)) {
      if (cuts.moveSteps > 0) cuts.moveSteps--;
      const swing = wielder.swing, weapon = weaponIn(wielder.hands);
      if (cuts.want === cuts.to || !weapon || (swing !== null && swing.step < swing.liveUntil)) continue;
      cuts.to = cuts.want;
      cuts.moveSteps = guardMoveSteps(weapon.heft, swing !== null);
      const stamina = world.get(e, Stamina);
      if (stamina && world.has(e, Player)) spend(stamina, MASTER_CUTS.guard.cost);
    }
  };
}

export function masterCutsAfter(events: FightEvent[]): System {
  const grabs = guardBreakSystem(events), guards = guardSystem();
  return (world, dt) => {
    grabs(world, dt);
    guards(world, dt);
  };
}
