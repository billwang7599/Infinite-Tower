import type { Entity, World } from "../../../../core/ecs.js";
import { DEFLECT_STEPS, deflectPosture, POSTURE } from "../../../../weapons/posture.js";
import { COMBAT, weaponIn } from "../../../../weapons/weapons.js";
import {
  Body, Enemy, Fighter, Health, LungeAttack, Player, Posture, WeaponAttack, Wielder, type ActiveHitData,
  type PlayerData, type PostureData,
} from "../../../components.js";
import { enter } from "../../behaviors/common.js";
import { faces, HIT_FLASH_TIME, inIframes, knock, stagger, type Defended } from "../../combat.js";
import type { FightEvent } from "../../context.js";
import { hurt } from "../../skills/statuses.js";
import { facingOf } from "../../weapons/guard-break.js";
import { endSwing } from "../../weapons/swing.js";
import { addPosture, guarding } from "./posture.js";

export function postureDefend(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity,
): Defended {
  const posture = world.get(target, Posture);
  if (!posture) return null;
  const player = world.get(target, Player);
  // Only a thrust reaches a dodge: the dodge beats it, or it's a Mikiri.
  if (player && inIframes(player)) return mikiri(world, events, attacker, target, player) ? "parried" : "blocked";
  const inFront = faces(world.require(target, Body).pos, facingOf(world, target), world.require(attacker, Body).pos,
    POSTURE.guardMinDot);
  if (inFront && deflects(world, target, hit)) {
    deflected(world, events, attacker, hit, target);
    return "parried";
  }
  const theirs = world.get(attacker, Posture);
  if (theirs) theirs.connected = true;
  if (inFront && guardable(hit) && guarding(world, target)) {
    events.push({ type: "block", by: attacker, target });
    addPosture(world, events, target, hit.posture, attacker);
    if (hit.attack === null) {
      const body = world.require(target, Body), from = world.require(attacker, Body).pos;
      knock(body.pos, from, body.vel, hit.knockback * COMBAT.pushbackFactor, 0, { x: hit.dirX, z: hit.dirZ });
    }
    return "blocked";
  }
  if (posture.brokenTime > 0 && hit.attack !== null) {
    deathblow(world, events, attacker, target, posture);
    return "struck";
  }
  if (hit.perilous === "sweep") stagger(world, target, POSTURE.sweepStaggerTime);
  addPosture(world, events, target, hit.posture * POSTURE.hitShare, attacker);
  return null;
}

const guardable = (hit: ActiveHitData): boolean => hit.perilous === null && (hit.attack !== null || hit.posture > 0);

function deflects(world: World, target: Entity, hit: ActiveHitData): boolean {
  if (!guardable(hit) && hit.perilous !== "thrust") return false;
  const player = world.get(target, Player);
  if (!player) return (world.get(target, WeaponAttack)?.parryRead ?? false) && guarding(world, target);
  if ((player.action !== "none" && player.action !== "block") || !weaponIn(world.require(target, Wielder).hands)) {
    return false;
  }
  const window = hit.perilous === "thrust" ? Math.min(DEFLECT_STEPS.thrust, player.deflectWindowSteps)
    : player.deflectWindowSteps;
  return player.sinceGuardPressSteps <= window;
}

function deflected(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): void {
  const d = POSTURE.deflect, theirs = world.get(attacker, Posture);
  events.push({ type: "parry", by: target, target: attacker, attack: hit.attack ?? "light" });
  const player = world.get(target, Player), attack = world.get(target, WeaponAttack);
  if (player) player.deflectWindowSteps = DEFLECT_STEPS.window;
  if (attack) Object.assign(attack, { parryRead: false, riposte: true });
  addPosture(world, events, target, hit.posture * d.takenShare, attacker);
  recoil(world, attacker, d.recoilTime);
  const gain = hit.attack === null ? d.bodyBlowPosture : deflectPosture(theirs?.streak ?? 0);
  if (theirs) Object.assign(theirs, { streak: theirs.streak + 1, streakTime: 0 });
  addPosture(world, events, attacker, gain, target);
}

function recoil(world: World, e: Entity, time: number): void {
  const player = world.get(e, Player), enemy = world.get(e, Enemy);
  if (player) {
    endSwing(world, e);
    player.action = "recoil";
    world.require(e, Health).hitstun = time;
  } else if (enemy) {
    enter(world, e, enemy, "recoil", time);
    const lunge = world.get(e, LungeAttack);
    if (lunge) lunge.cooldown = Math.max(lunge.cooldown, time + lunge.def.cooldown);
  }
}

function mikiri(world: World, events: FightEvent[], attacker: Entity, target: Entity, player: PlayerData): boolean {
  const m = POSTURE.mikiri, body = world.require(target, Body);
  if (player.actionTime >= m.withinTime || !faces(body.pos, player.actionDir, world.require(attacker, Body).pos,
    m.minDot)) return false;
  player.action = "none";
  body.vel.x = body.vel.z = 0;
  events.push({ type: "posture", by: target, target: attacker, what: "mikiri" });
  stagger(world, attacker, m.openTime);
  addPosture(world, events, attacker, m.posture, target);
  return true;
}

function deathblow(world: World, events: FightEvent[], attacker: Entity, target: Entity, posture: PostureData): void {
  const health = world.require(target, Health);
  const damage = hurt(world, target, health.max * POSTURE.broken.deathblowShare, "physical");
  health.flash = HIT_FLASH_TIME;
  Object.assign(posture, { value: 0, brokenTime: 0 });
  const team = world.require(target, Fighter).team;
  events.push({ type: "hit", by: attacker, target, team, damage, weapon: true });
  events.push({ type: "posture", by: attacker, target, what: "deathblow" });
}
