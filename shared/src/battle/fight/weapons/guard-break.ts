import type { Entity, System, World } from "../../../core/ecs.js";
import type { Vec2 } from "../../../core/math.js";
import { toSteps } from "../../../core/time.js";
import { GUARD_BREAK, guardBreakOpenTime, weaponIn } from "../../../weapons/weapons.js";
import {
  Body, Enemy, Fighter, Health, Player, Skilled, WeaponAttack, Wielder, type EnemyState, type GrabData,
  type PlayerAction, type WielderData,
} from "../../components.js";
import { enter, roll } from "../behaviors/common.js";
import { breakOff, knock, stagger } from "../combat.js";
import type { FightEvent } from "../context.js";
import { endSwing } from "./swing.js";

const GRAB_STEPS = toSteps(GUARD_BREAK.grabTime);
const TECH_STEPS = toSteps(GUARD_BREAK.techTime);
const WHIFF_STEPS = toSteps(GUARD_BREAK.whiffTime);
const OPEN_ACTIONS: ReadonlySet<PlayerAction> = new Set([
  "none", "attack", "recoil", "cast", "chant", "write", "beam", "bag", "use",
]);
export const OPEN_STATES: ReadonlySet<EnemyState> = new Set([
  "approach", "recoil", "weaponRecover", "lungeRecover", "chargeRecover", "skillChant",
]);

export function startGrab(wielder: WielderData): void {
  wielder.grab = { step: 0, target: null, techAt: null };
}

export function facingOf(world: World, e: Entity): Vec2 {
  const player = world.get(e, Player);
  if (player) return player.actionDir;
  const yaw = world.require(e, Enemy).yaw;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

/** `reachM`: from the centre to the target's edge; `minDot`: the cosine of how far off where it faces. */
export interface Reach { reachM: number; minDot: number }

export function inReach(world: World, from: Entity, target: Entity, reach: Reach): boolean {
  const at = world.require(from, Body).pos, to = world.require(target, Body).pos, way = facingOf(world, from);
  const dx = to.x - at.x, dz = to.z - at.z, dist = Math.hypot(dx, dz);
  return dist - world.require(target, Fighter).radius <= reach.reachM
    && (dist < 1e-6 || (dx * way.x + dz * way.z) / dist >= reach.minDot);
}

export const inGrabReach = (world: World, grabber: Entity, target: Entity): boolean =>
  inReach(world, grabber, target, GUARD_BREAK);

export function grabbable(world: World, e: Entity): boolean {
  const wielder = world.get(e, Wielder), swing = wielder?.swing, player = world.get(e, Player);
  const enemy = world.get(e, Enemy);
  if (!wielder || !weaponIn(wielder.hands) || wielder.grabImmuneTime > 0 || world.require(e, Health).hp <= 0) {
    return false;
  }
  if (swing && swing.step < swing.liveUntil) return false;
  return player ? OPEN_ACTIONS.has(player.action) : enemy !== undefined && OPEN_STATES.has(enemy.state);
}

export function nearestInReach(world: World, from: Entity, reach: Reach): Entity | null {
  const side = world.require(from, Fighter).side, at = world.require(from, Body).pos;
  let best: Entity | null = null, bestDist = Infinity;
  for (const [e, fighter, body, health] of world.query(Fighter, Body, Health)) {
    if (fighter.side === side || health.hp <= 0 || !inReach(world, from, e, reach)) continue;
    const dist = Math.hypot(body.pos.x - at.x, body.pos.z - at.z);
    if (dist < bestDist) [best, bestDist] = [e, dist];
  }
  return best;
}

const grabbing = (world: World, e: Entity): boolean => world.require(e, Health).hp > 0
  && (world.get(e, Player)?.action === "grab" || world.get(e, Enemy)?.state === "guardBreak");

const held = (world: World, e: Entity): boolean => world.require(e, Health).hp > 0
  && (world.get(e, Player)?.action === "grabbed" || world.get(e, Enemy)?.state === "grabbed");

function seize(world: World, grab: GrabData, target: Entity): void {
  grab.target = target;
  endSwing(world, target);
  const player = world.get(target, Player), enemy = world.get(target, Enemy);
  if (player) {
    breakOff(player, world.require(target, Skilled));
    player.action = "grabbed";
  } else if (enemy) {
    enter(world, target, enemy, "grabbed");
    const counters = world.get(target, WeaponAttack)?.def.counters;
    if (counters && roll(enemy) < counters.techChance) grab.techAt = grab.step + toSteps(counters.reactTime);
  }
}

function free(world: World, e: Entity): void {
  const player = world.get(e, Player), enemy = world.get(e, Enemy);
  if (player?.action === "grabbed") player.action = "none";
  if (enemy?.state === "grabbed") enter(world, e, enemy, "approach");
}

function teched(world: World, grab: GrabData, target: Entity): boolean {
  const player = world.get(target, Player);
  if (!player) return grab.techAt !== null && grab.step >= grab.techAt;
  const pressed = player.guardBreakBuffer > 0;
  player.guardBreakBuffer = 0;
  return pressed;
}

function letGo(world: World, e: Entity, wielder: WielderData, broke: boolean): void {
  wielder.grab = null;
  const player = world.get(e, Player), enemy = world.get(e, Enemy);
  if (player?.action === "grab") player.action = "none";
  if (enemy?.state !== "guardBreak") return;
  enter(world, e, enemy, "approach");
  const attack = world.get(e, WeaponAttack);
  if (attack && broke) attack.riposte = true;
  else if (attack) attack.cooldown = Math.max(attack.cooldown, attack.def.cooldown);
}

export function guardBreakSystem(events: FightEvent[]): System {
  return (world, dt) => {
    for (const [, wielder] of world.query(Wielder)) wielder.grabImmuneTime = Math.max(0, wielder.grabImmuneTime - dt);
    for (const [e, wielder] of world.query(Wielder)) {
      const grab = wielder.grab;
      if (!grab) continue;
      const target = grab.target;
      if (!grabbing(world, e)) {
        if (target !== null && held(world, target)) free(world, target);
        wielder.grab = null;
        continue;
      }
      if (target === null) {
        const found = grab.step === GRAB_STEPS ? nearestInReach(world, e, GUARD_BREAK) : null;
        if (found !== null && grabbable(world, found)) {
          seize(world, grab, found);
          events.push({ type: "guardBreak", by: e, target: found, result: "grabbed" });
        } else if (grab.step >= WHIFF_STEPS) {
          letGo(world, e, wielder, false);
        }
      } else if (!held(world, target)) {
        letGo(world, e, wielder, false);
      } else if (teched(world, grab, target)) {
        free(world, target);
        const a = world.require(e, Body), b = world.require(target, Body);
        knock(a.pos, b.pos, a.vel, GUARD_BREAK.techPushSpeed);
        knock(b.pos, a.pos, b.vel, GUARD_BREAK.techPushSpeed);
        letGo(world, e, wielder, false);
        events.push({ type: "guardBreak", by: e, target, result: "teched" });
      } else if (grab.step >= GRAB_STEPS + TECH_STEPS) {
        const openTime = guardBreakOpenTime(weaponIn(wielder.hands)!);
        stagger(world, target, openTime);
        world.require(target, Wielder).grabImmuneTime = openTime + GUARD_BREAK.immuneTime;
        letGo(world, e, wielder, true);
        events.push({ type: "guardBreak", by: e, target, result: "broken" });
      }
      if (wielder.grab) grab.step++;
    }
  };
}
