import { toSteps } from "../../../core/time.js";
import { stowedCounts, unstow } from "../../../items/gear.js";
import { drawCost, drawTime, loosedDamage, loosedSpeed, type RangedMoves } from "../../../weapons/bow.js";
import { weaponItemIn } from "../../../weapons/weapons.js";
import { Body, Fighter, Health, Projectile, Skilled } from "../../components.js";
import { FighterStats } from "../../stats.js";
import { modsOf } from "../../statuses.js";
import { canPayStamina, payStamina } from "../combat.js";
import { launchAt } from "../weapons/projectile.js";
import { startAction } from "./controller.js";
import type { SwordTurn } from "./sword.js";

/** A live lock-on's target, at the middle of its height. */
function lockedAt(t: SwordTurn) {
  const target = t.world.require(t.e, Skilled).target, health = target === null ? null : t.world.get(target, Health);
  if (target === null || !health || health.hp <= health.floor) return null;
  const { pos, centerHeight } = t.world.require(target, Body);
  return { ...pos, y: pos.y - centerHeight + t.world.require(target, Fighter).heightM / 2 };
}

function loose(t: SwordTurn, bow: RangedMoves): void {
  const { world, e, player, input } = t, drawnTime = player.actionTime, def = bow.projectile;
  const to = lockedAt(t), pos = world.require(e, Body).pos;
  const toward = to && Math.hypot(to.x - pos.x, to.z - pos.z) > 0 ? to : null;
  const flat = toward ? Math.hypot(toward.x - pos.x, toward.z - pos.z) : 1;
  const dir = toward ? { x: (toward.x - pos.x) / flat, z: (toward.z - pos.z) / flat } : { x: input.aimX, z: input.aimZ };
  startAction(world, e, player, "loose", dir.x, dir.z);
  const gear = unstow(player.gear, bow.ammo, 1), weapon = weaponItemIn(t.wielder.hands);
  if (!gear || !weapon) return;
  player.gear = gear;
  const stats = world.require(e, FighterStats), speed = loosedSpeed(bow, t.weapon!, stats.strength, drawnTime);
  const from = { x: pos.x + dir.x * def.releaseOutM, y: pos.y + def.releaseUpM, z: pos.z + dir.z * def.releaseOutM };
  const level = speed * Math.cos(input.aimPitchRad);
  const along = { x: dir.x * level, y: speed * Math.sin(input.aimPitchRad), z: dir.z * level };
  const vel = (toward && launchAt(from, toward, speed, def.gravityMps2)) ?? along;
  world.add(world.spawn(), Projectile, {
    shooter: e, weapon, pos: from, vel, left: def.lifeTime, stuck: false,
    damage: loosedDamage(bow, t.weapon!, drawnTime, stats),
  });
}

export function drawBow(t: SwordTurn, bow: RangedMoves): boolean {
  const { world, e, player, input, stamina, weapon } = t, strength = world.require(e, FighterStats).strength;
  if (!weapon) return false;
  if (player.action === "draw") {
    const held = input.attack === "light" || input.attackHeld;
    const ready = toSteps(player.actionTime) >= toSteps(drawTime(bow, weapon, strength, "minTime"));
    if (!held && ready) loose(t, bow);
    return true;
  }
  const cost = drawCost(bow, weapon, strength) * modsOf(world, e).attackCostFactor;
  const armed = (stowedCounts(player.gear)[bow.ammo] ?? 0) > 0;
  if (!t.free || player.attackBuffer <= 0 || player.queued !== "light" || !armed
    || !canPayStamina(world, e, stamina, cost)) return false;
  startAction(world, e, player, "draw", input.aimX, input.aimZ);
  payStamina(world, e, stamina, cost);
  player.attackBuffer = 0;
  return true;
}
