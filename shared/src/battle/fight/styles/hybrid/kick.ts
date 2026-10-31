import type { Entity, System, World } from "../../../../core/ecs.js";
import { toSteps } from "../../../../core/time.js";
import { HYBRID } from "../../../../weapons/hybrid.js";
import { Body, Enemy, Health, Player, WeaponAttack, Wielder } from "../../../components.js";
import { PLAYER } from "../../../player.js";
import { enter } from "../../behaviors/common.js";
import { knock, stagger } from "../../combat.js";
import type { FightEvent } from "../../context.js";
import { nearestInReach, OPEN_STATES } from "../../weapons/guard-break.js";
import { blocking } from "./defend.js";

const CONTACT_STEPS = toSteps(HYBRID.kick.contactTime);
const END_STEPS = toSteps(HYBRID.kick.time);

const kicking = (world: World, e: Entity): boolean => world.require(e, Health).hp > 0
  && (world.get(e, Player)?.action === "kick" || world.get(e, Enemy)?.state === "kick");

export function kickSystem(events: FightEvent[]): System {
  return (world) => {
    for (const [e, wielder] of world.query(Wielder)) {
      const kick = wielder.kick;
      if (!kick) continue;
      if (!kicking(world, e)) {
        wielder.kick = null;
        continue;
      }
      if (kick.step === CONTACT_STEPS) {
        const target = nearestInReach(world, e, HYBRID.kick);
        if (target !== null) land(world, events, e, target);
      }
      kick.step++;
      if (kick.step < END_STEPS) continue;
      wielder.kick = null;
      const player = world.get(e, Player), enemy = world.get(e, Enemy);
      if (player) player.action = "none";
      else if (enemy) enter(world, e, enemy, "approach");
    }
  };
}

function land(world: World, events: FightEvent[], kicker: Entity, target: Entity): void {
  const player = world.get(target, Player), enemy = world.get(target, Enemy);
  const swing = world.get(target, Wielder)?.swing;
  const dodging = player?.action === "dodge" && player.actionTime < PLAYER.dodge.iframeEnd;
  const busy = dodging || (swing != null && swing.step < swing.liveUntil)
    || (enemy !== undefined && !OPEN_STATES.has(enemy.state));
  let result: "staggered" | "shoved" | "nothing";
  if (busy) result = "nothing";
  else if (blocking(world, target)) {
    stagger(world, target, HYBRID.kick.staggerTime);
    const attack = world.get(kicker, WeaponAttack);
    if (attack) attack.riposte = true;
    result = "staggered";
  } else {
    stagger(world, target, HYBRID.kick.shoveTime);
    const body = world.require(target, Body);
    knock(body.pos, world.require(kicker, Body).pos, body.vel, HYBRID.kick.shoveSpeed);
    result = "shoved";
  }
  events.push({ type: "kick", by: kicker, target, result });
}
