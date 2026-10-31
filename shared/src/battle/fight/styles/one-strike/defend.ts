import type { Entity, World } from "../../../../core/ecs.js";
import { toSteps } from "../../../../core/time.js";
import {
  insidePoint, landedCutSteps, ONE_STRIKE, SET_MIN_DOT, zoneShare,
} from "../../../../weapons/one-strike.js";
import { weaponIn } from "../../../../weapons/weapons.js";
import {
  Body, Enemy, Fighter, Health, LungeAttack, OneStrike, Player, Statuses, Wielder, type ActiveHitData,
} from "../../../components.js";
import { PLAYER } from "../../../player.js";
import { FighterStats, stunTime } from "../../../stats.js";
import { enter } from "../../behaviors/common.js";
import { faces, HIT_FLASH_TIME, knock, stagger, type Defended } from "../../combat.js";
import type { FightEvent } from "../../context.js";
import { MAX_FIGHT_TIME } from "../../outcome.js";
import { damageDealtFactor, hurt, siphon } from "../../skills/statuses.js";
import { bladeLive, endSwing } from "../../weapons/swing.js";
import { armed, facing, gapTo, heftOf, lineOf, movingTo } from "./blade.js";

export function oneStrikeDefend(
  world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity,
): Defended {
  if (hit.attack === null) return bodyBlow(world, events, attacker, hit, target);
  if (hit.line === null) return punched(world, events, attacker, hit, target);
  const weapon = weaponIn(world.require(attacker, Wielder).hands);
  if (!weapon || insidePoint(gapTo(world, attacker, target), weapon)) return "struck";
  const blade = world.get(target, OneStrike);
  if (blade && facesFoe(world, target, attacker, ONE_STRIKE.clash.minDot)) {
    if (lineOf(world, target) === hit.line) {
      clash(world, events, attacker, target, ONE_STRIKE.clash.recoilTime * weapon.heft);
      return "blocked";
    }
    if (movingTo(blade) === hit.line && armed(world, target)) {
      disarm(world, events, attacker, target);
      return "parried";
    }
  }
  return landed(world, events, attacker, hit, target);
}

const facesFoe = (world: World, e: Entity, foe: Entity, minDot: number): boolean =>
  faces(world.require(e, Body).pos, facing(world, e), world.require(foe, Body).pos, minDot);

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

function clash(world: World, events: FightEvent[], thruster: Entity, target: Entity, recoilTime: number): void {
  const c = ONE_STRIKE.clash, a = world.require(thruster, Body), b = world.require(target, Body);
  recoil(world, thruster, recoilTime);
  recoil(world, target, c.pushTime);
  knock(a.pos, b.pos, a.vel, c.pushSpeed);
  knock(b.pos, a.pos, b.vel, c.pushSpeed);
  events.push({ type: "strike", by: thruster, target, what: "clash" });
}

function disarm(world: World, events: FightEvent[], thruster: Entity, by: Entity): void {
  const blade = world.require(thruster, OneStrike), at = world.require(thruster, Body).pos;
  const from = world.require(by, Body).pos, dx = at.x - from.x, dz = at.z - from.z, l = Math.hypot(dx, dz) || 1;
  const throwM = ONE_STRIKE.disarm.throwM;
  Object.assign(blade, {
    loose: { x: at.x + (dx / l) * throwM, z: at.z + (dz / l) * throwM }, moveSteps: 0, to: blade.line,
    offLineSteps: 0, beatStep: null,
  });
  recoil(world, thruster, ONE_STRIKE.disarm.recoilTime);
  events.push({ type: "strike", by, target: thruster, what: "disarm" });
}

function hurtBy(
  world: World, events: FightEvent[], by: Entity, target: Entity, damage: number, weapon: boolean,
): boolean {
  const health = world.require(target, Health);
  const dealt = hurt(world, target, damage, "physical");
  health.flash = HIT_FLASH_TIME;
  if (world.has(target, Player)) health.invuln = PLAYER.hurtInvuln;
  siphon(world, by, dealt);
  events.push({ type: "hit", by, target, team: world.require(target, Fighter).team, damage: dealt, weapon });
  return health.hp > 0;
}

function landed(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): Defended {
  const beast = world.get(target, Enemy)?.def.beast ?? false, share = zoneShare(beast, hit.line!);
  if (share === null) return "struck";
  const own = world.get(target, Wielder)?.swing;
  const standing = hurtBy(world, events, attacker, target, world.require(target, Health).max * share, true);
  if (hit.line === "low" && !beast) world.require(target, Statuses).left.lamed = MAX_FIGHT_TIME;
  if (standing && !(own && bladeLive(own))) {
    stagger(world, target, stunTime(ONE_STRIKE.thrust.staggerTime, world.require(target, FighterStats)));
  }
  const swing = world.get(attacker, Wielder)?.swing, heft = heftOf(world, attacker);
  const missed = toSteps(ONE_STRIKE.thrust.missRecoverTime * heft);
  if (swing && swing.endAt - swing.liveUntil === missed) swing.endAt -= landedCutSteps(heft);
  return "struck";
}

function punched(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): Defended {
  const damage = hit.damage * damageDealtFactor(world, attacker);
  if (hurtBy(world, events, attacker, target, damage, false)) {
    stagger(world, target, stunTime(ONE_STRIKE.punch.staggerTime, world.require(target, FighterStats)));
  }
  return "struck";
}

function bodyBlow(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): Defended {
  const enemy = world.get(attacker, Enemy), blade = world.get(target, OneStrike);
  if (!enemy || !blade) return null;
  if (enemy.state === "charge") return set(world, target) ? impaled(world, events, attacker, target) : null;
  const line = hit.line;
  if (line === null || !facesFoe(world, target, attacker, ONE_STRIKE.clash.minDot)) return null;
  if (lineOf(world, target) !== line && !(movingTo(blade) === line && armed(world, target))) return null;
  clash(world, events, attacker, target, ONE_STRIKE.beast.lungeRecoilTime);
  return "blocked";
}

function set(world: World, e: Entity): boolean {
  const blade = world.require(e, OneStrike), b = ONE_STRIKE.beast;
  return lineOf(world, e) === "low" && blade.stillSteps >= toSteps(b.setTime)
    && world.get(e, Player)?.action !== "dodge";
}

function impaled(world: World, events: FightEvent[], boar: Entity, by: Entity): Defended {
  if (!facesFoe(world, by, boar, SET_MIN_DOT)) return null;
  const health = world.require(boar, Health), i = ONE_STRIKE.beast.impale;
  hurtBy(world, events, by, boar, health.max * zoneShare(true, "low")!, true);
  recoil(world, by, i.pushTime);
  const at = world.require(by, Body);
  knock(at.pos, world.require(boar, Body).pos, at.vel, i.pushSpeed);
  events.push({ type: "strike", by, target: boar, what: "impale" });
  return "struck";
}
