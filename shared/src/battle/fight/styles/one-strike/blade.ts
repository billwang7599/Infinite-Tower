import type { Entity, System, World } from "../../../../core/ecs.js";
import type { Vec2 } from "../../../../core/math.js";
import { toSteps } from "../../../../core/time.js";
import {
  lineMoveSteps, lineToward, ONE_STRIKE, thrustReach, type Line,
} from "../../../../weapons/one-strike.js";
import { weaponIn } from "../../../../weapons/weapons.js";
import type { ArenaDef } from "../../../../world/arena.js";
import {
  Body, Enemy, Fighter, Health, OneStrike, Player, Skilled, Wielder, type EnemyState, type OneStrikeData,
  type PlayerAction,
} from "../../../components.js";
import { enter } from "../../behaviors/common.js";
import type { FightEvent } from "../../context.js";
import { nearestInReach } from "../../weapons/guard-break.js";
import { endSwing } from "../../weapons/swing.js";

const REELING_ACTIONS: ReadonlySet<PlayerAction> = new Set(["stagger", "grabbed"]);
const REELING_STATES: ReadonlySet<EnemyState> = new Set(["staggered", "stunned", "grabbed", "dead"]);

export function spawnBlade(world: World, e: Entity): void {
  if (!world.has(e, Wielder)) return;
  const line = ONE_STRIKE.startLine;
  world.add(e, OneStrike, {
    line, to: line, want: line, moveSteps: 0, offLineSteps: 0, stillSteps: 0, beatStep: null, pickupStep: null,
    loose: null,
  });
}

export const heftOf = (world: World, e: Entity): number => weaponIn(world.require(e, Wielder).hands)?.heft ?? 1;

export function armed(world: World, e: Entity): boolean {
  const blade = world.get(e, OneStrike), hands = world.get(e, Wielder)?.hands;
  return blade !== undefined && blade.loose === null && hands !== undefined && weaponIn(hands) !== null;
}

function reeling(world: World, e: Entity): boolean {
  const player = world.get(e, Player), enemy = world.get(e, Enemy);
  return world.require(e, Health).hp <= 0 || (player !== undefined && REELING_ACTIONS.has(player.action))
    || (enemy !== undefined && REELING_STATES.has(enemy.state));
}

export function lineOf(world: World, e: Entity): Line | null {
  const blade = world.get(e, OneStrike);
  if (!blade || !armed(world, e) || blade.offLineSteps > 0 || blade.moveSteps > 0 || reeling(world, e)) return null;
  return blade.line;
}

export const movingTo = (blade: OneStrikeData): Line | null => (blade.moveSteps > 0 ? blade.want : null);

// Not facingOf: a player's actionDir changes only as an action starts, its aim every step.
export function facing(world: World, e: Entity): Vec2 {
  if (world.has(e, Player)) return world.require(e, Skilled).aim;
  const yaw = world.require(e, Enemy).yaw;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function gapTo(world: World, from: Entity, to: Entity): number {
  const a = world.require(from, Body).pos, b = world.require(to, Body).pos;
  return Math.hypot(a.x - b.x, a.z - b.z) - world.require(to, Fighter).radius;
}

function endBeat(world: World, e: Entity, blade: OneStrikeData): void {
  blade.beatStep = null;
  const player = world.get(e, Player), enemy = world.get(e, Enemy);
  if (player?.action === "beat") player.action = "none";
  if (enemy?.state === "beat") enter(world, e, enemy, "approach");
}

export function knockAside(world: World, e: Entity, blade: OneStrikeData, time: number): void {
  Object.assign(blade, { offLineSteps: toSteps(time), moveSteps: 0, to: blade.line, stillSteps: 0 });
  const swing = world.get(e, Wielder)?.swing, player = world.get(e, Player), enemy = world.get(e, Enemy);
  if (swing && swing.step < swing.liveAt) {
    endSwing(world, e);
    if (player?.action === "attack") player.action = "none";
    if (enemy?.state === "weaponWindup" || enemy?.state === "weapon") enter(world, e, enemy, "approach");
  }
}

function beatLands(world: World, events: FightEvent[], e: Entity, blade: OneStrikeData): void {
  const b = ONE_STRIKE.beat, armReachM = world.require(e, Wielder).armReachM;
  const mine = thrustReach(armReachM, weaponIn(world.require(e, Wielder).hands)!);
  const target = nearestInReach(world, e, { reachM: mine + b.reachExtraM, minDot: b.minDot });
  const theirs = target === null ? undefined : world.get(target, OneStrike);
  const theirWeapon = target === null ? null : weaponIn(world.require(target, Wielder).hands);
  const reach = theirWeapon && Math.min(mine, thrustReach(world.require(target!, Wielder).armReachM, theirWeapon));
  if (target !== null && theirs && reach !== null && gapTo(world, e, target) <= reach + b.reachExtraM
    && lineOf(world, target) === blade.line) {
    if (theirs.beatStep !== null) endBeat(world, target, theirs);
    knockAside(world, target, theirs, b.offLineTime);
    events.push({ type: "strike", by: e, target, what: "beat" });
    return;
  }
  knockAside(world, e, blade, b.missOffLineTime);
  events.push({ type: "strike", by: target ?? e, target: e, what: "offLine" });
}

function tickBeat(world: World, events: FightEvent[], e: Entity, blade: OneStrikeData, heft: number): void {
  if (blade.beatStep === null) return;
  const beating = world.get(e, Player)?.action === "beat" || world.get(e, Enemy)?.state === "beat";
  if (!beating) {
    blade.beatStep = null;
    return;
  }
  const windup = toSteps(ONE_STRIKE.beat.windupTime * heft);
  if (++blade.beatStep === windup) beatLands(world, events, e, blade);
  if (blade.beatStep !== null && blade.beatStep >= windup) endBeat(world, e, blade);
}

function tickPickup(world: World, events: FightEvent[], e: Entity, blade: OneStrikeData): void {
  if (blade.pickupStep === null) return;
  const player = world.get(e, Player), enemy = world.get(e, Enemy);
  if (!blade.loose || (player && player.action !== "pickup") || (enemy && enemy.state !== "pickup")) {
    blade.pickupStep = null;
    return;
  }
  if (++blade.pickupStep < toSteps(ONE_STRIKE.pickup.time)) return;
  Object.assign(blade, { loose: null, pickupStep: null, to: blade.line });
  if (player) player.action = "none";
  if (enemy) enter(world, e, enemy, "approach");
  events.push({ type: "strike", by: e, target: e, what: "pickup" });
}

function tickLine(world: World, e: Entity, blade: OneStrikeData, heft: number): void {
  if (blade.offLineSteps > 0) {
    blade.offLineSteps--;
    blade.stillSteps = 0;
    return;
  }
  if (!armed(world, e)) {
    Object.assign(blade, { moveSteps: 0, to: blade.line, stillSteps: 0 });
    return;
  }
  if (blade.moveSteps > 0 && --blade.moveSteps === 0) blade.line = blade.to;
  const busy = world.require(e, Wielder).swing !== null || blade.beatStep !== null || reeling(world, e);
  if (blade.moveSteps === 0 && blade.want !== blade.line && !busy) {
    blade.to = lineToward(blade.line, blade.want);
    blade.moveSteps = lineMoveSteps(heft);
  }
  blade.stillSteps = blade.moveSteps > 0 ? 0 : blade.stillSteps + 1;
}

export function bladeSystem(events: FightEvent[], arena: ArenaDef): System {
  const most = arena.radius - ONE_STRIKE.disarm.wallGapM;
  return (world) => {
    for (const [e, blade] of world.query(OneStrike)) {
      const loose = blade.loose, r = loose ? Math.hypot(loose.x, loose.z) : 0;
      if (loose && r > most) blade.loose = { x: (loose.x / r) * most, z: (loose.z / r) * most };
      const heft = heftOf(world, e);
      tickBeat(world, events, e, blade, heft);
      tickPickup(world, events, e, blade);
      tickLine(world, e, blade, heft);
    }
  };
}
