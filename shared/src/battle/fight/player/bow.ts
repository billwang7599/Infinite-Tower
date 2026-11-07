import { toSteps } from "../../../core/time.js";
import { stowedCounts, unstow } from "../../../items/gear.js";
import { drawCost, drawTime, loosedDamage, loosedSpeed, type RangedMoves } from "../../../weapons/bow.js";
import { weaponItemIn } from "../../../weapons/weapons.js";
import { Body, Projectile } from "../../components.js";
import { FighterStats } from "../../stats.js";
import { modsOf } from "../../statuses.js";
import { aimOf } from "../aim.js";
import { canPayStamina, payStamina } from "../combat.js";
import { launchAt } from "../weapons/projectile.js";
import { startAction } from "./controller.js";
import type { SwordTurn } from "./sword.js";

function loose(t: SwordTurn, bow: RangedMoves): void {
  const { world, e, player } = t, drawnTime = player.actionTime, def = bow.projectile;
  const { dir, at, target } = aimOf(world, e), pos = world.require(e, Body).pos;
  startAction(world, e, player, "loose", dir.x, dir.z);
  const gear = unstow(player.gear, bow.ammo, 1), weapon = weaponItemIn(t.wielder.hands);
  if (!gear || !weapon) return;
  player.gear = gear;
  const stats = world.require(e, FighterStats), speed = loosedSpeed(bow, t.weapon!, stats.strength, drawnTime);
  const from = { x: pos.x + dir.x * def.releaseOutM, y: pos.y + def.releaseUpM, z: pos.z + dir.z * def.releaseOutM };
  const to = { x: at.x - from.x, y: at.y - from.y, z: at.z - from.z }, lineM = Math.hypot(to.x, to.y, to.z);
  const straight = lineM > 0 ? { x: to.x / lineM, y: to.y / lineM, z: to.z / lineM } : { x: dir.x, y: 0, z: dir.z };
  const vel = (target === null ? null : launchAt(def, from, at, speed))
    ?? { x: straight.x * speed, y: straight.y * speed, z: straight.z * speed };
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
