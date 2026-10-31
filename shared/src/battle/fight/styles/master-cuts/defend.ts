import type { Entity, World } from "../../../../core/ecs.js";
import { BREAKS, COUNTER_STEPS, cutCost, MASTER_CUTS } from "../../../../weapons/master-cuts.js";
import { weaponIn } from "../../../../weapons/weapons.js";
import {
  Body, Cuts, Enemy, Health, LungeAttack, Player, Stamina, WeaponAttack, Wielder, type ActiveHitData,
} from "../../../components.js";
import { enter } from "../../behaviors/common.js";
import { faces, stagger, type Defended } from "../../combat.js";
import type { FightEvent } from "../../context.js";
import { spend } from "../../player/controller.js";
import { endSwing } from "../../weapons/swing.js";

export function masterCutsDefend(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity,
): Defended {
  const counter = world.get(target, Wielder)?.swing;
  // The weapon system ran this step: the counter's clock is one step on.
  if (!world.has(target, Cuts) || !counter?.stance || counter.attack !== "heavy" || counter.step - 1 > COUNTER_STEPS
    || !faces(world.require(target, Body).pos, counter.dir, world.require(attacker, Body).pos,
      MASTER_CUTS.counter.minDot)) return null;
  if (hit.attack === "heavy" && hit.stance !== null && BREAKS[hit.stance] === counter.stance) return null;
  const weapon = weaponIn(world.require(target, Wielder).hands)!, stamina = world.get(target, Stamina);
  if (stamina) stamina.value = Math.min(stamina.max, stamina.value + cutCost(weapon, "cut"));
  if (hit.stance !== null && BREAKS[counter.stance] === hit.stance) {
    stagger(world, attacker, MASTER_CUTS.counter.openTime);
    events.push({ type: "cut", by: target, target: attacker, what: "displace" });
    return "parried";
  }
  const bind = MASTER_CUTS.bind;
  recoil(world, attacker, bind.attackerRecoilTime);
  recoil(world, target, bind.counterRecoilTime);
  for (const e of [attacker, target]) {
    const paying = world.get(e, Stamina);
    if (paying) spend(paying, bind.cost);
  }
  const riposte = world.get(target, WeaponAttack);
  if (riposte) riposte.riposte = true;
  events.push({ type: "cut", by: target, target: attacker, what: "bind" });
  return "parried";
}

function recoil(world: World, e: Entity, time: number): void {
  endSwing(world, e);
  const player = world.get(e, Player), enemy = world.get(e, Enemy);
  if (player) {
    player.action = "recoil";
    world.require(e, Health).hitstun = time;
  } else if (enemy) {
    enter(world, e, enemy, "recoil", time);
    const lunge = world.get(e, LungeAttack);
    if (lunge) lunge.cooldown = Math.max(lunge.cooldown, time + lunge.def.cooldown);
  }
}
