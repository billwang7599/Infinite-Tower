import type { Entity, System, World } from "../../../core/ecs.js";
import { toSteps } from "../../../core/time.js";
import { HYBRID } from "../../../weapons/hybrid.js";
import {
  Body, Enemy, Fighter, Health, Player, WeaponAttack, Wielder, type EnemyState,
} from "../../components.js";
import { PLAYER } from "../../player.js";
import { enter } from "../behaviors/common.js";
import { knock, stagger } from "../combat.js";
import type { FightEvent } from "../context.js";
import { blocking, facingOf } from "./defend.js";

const CONTACT_STEPS = toSteps(HYBRID.kick.contactTime);
const END_STEPS = toSteps(HYBRID.kick.time);
const OPEN_STATES: ReadonlySet<EnemyState> = new Set([
  "approach", "weaponRecover", "lungeRecover", "chargeRecover", "skillChant",
]);

/** `reachM`: from the centre to the target's edge; `minDot`: the cosine of how far off where it faces. */
interface Reach { reachM: number; minDot: number }

export function inReach(world: World, from: Entity, target: Entity, reach: Reach): boolean {
  const at = world.require(from, Body).pos, to = world.require(target, Body).pos, way = facingOf(world, from);
  const dx = to.x - at.x, dz = to.z - at.z, dist = Math.hypot(dx, dz);
  return dist - world.require(target, Fighter).radius <= reach.reachM
    && (dist < 1e-6 || (dx * way.x + dz * way.z) / dist >= reach.minDot);
}

function nearestInReach(world: World, from: Entity, reach: Reach): Entity | null {
  const side = world.require(from, Fighter).side, at = world.require(from, Body).pos;
  let best: Entity | null = null, bestDist = Infinity;
  for (const [e, fighter, body, health] of world.query(Fighter, Body, Health)) {
    if (fighter.side === side || health.hp <= 0 || !inReach(world, from, e, reach)) continue;
    const dist = Math.hypot(body.pos.x - at.x, body.pos.z - at.z);
    if (dist < bestDist) [best, bestDist] = [e, dist];
  }
  return best;
}

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
