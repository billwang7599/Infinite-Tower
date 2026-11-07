import type { Entity, World } from "../../../core/ecs.js";
import { distXZ, type Vec3 } from "../../../core/math.js";
import { SKILL_EFFECTS } from "../../../skills/effects.js";
import type { SkillElement } from "../../../skills/skill.js";
import { Body, Enemy, Fighter, Health, Statuses } from "../../components.js";
import { FighterStats, skillDamage, stunTime } from "../../stats.js";
import { HIT_FLASH_TIME, knock, knockbackOf } from "../combat.js";
import type { FightEvent } from "../context.js";
import { stun } from "../behaviors/common.js";
import { heal, hurt, lifesteal } from "../health.js";
import { applyStatus, endStatus, maxStacksOf, modsOf, stacksOf, statusOn, timeLeft } from "../../statuses.js";

const E = SKILL_EFFECTS.elements, R = SKILL_EFFECTS.reactions;

export const skillPower = (world: World, caster: Entity): number =>
  skillDamage(SKILL_EFFECTS.damage, world.require(caster, FighterStats)) * modsOf(world, caster).damageDealtFactor;

// Nearest first; `range` reaches to their surface.
export function foesNear(world: World, caster: Entity, at: Vec3, range: number, except?: Entity): Entity[] {
  const side = world.require(caster, Fighter).side;
  const found: { e: Entity; dist: number }[] = [];
  for (const [e, fighter, health, body] of world.query(Fighter, Health, Body)) {
    if (fighter.side === side || health.hp <= 0 || e === except) continue;
    const dist = distXZ(at, body.pos) - fighter.radius;
    if (dist <= range) found.push({ e, dist });
  }
  return found.sort((a, b) => a.dist - b.dist).map(({ e }) => e);
}

const resisted = (world: World, e: Entity, element: SkillElement): number =>
  1 - (world.get(e, Enemy)?.def.resist?.[element] ?? 0);

function damage(world: World, events: FightEvent[], caster: Entity, target: Entity, amount: number): number {
  const dealt = hurt(world, target, amount, "skill");
  world.require(target, Health).flash = HIT_FLASH_TIME;
  const team = world.require(target, Fighter).team;
  events.push({ type: "hit", by: caster, target, team, damage: dealt, weapon: false });
  lifesteal(world, caster, dealt);
  return dealt;
}

// `factor` scales the hit (its damage, poise damage and knockback), not the statuses.
export function strike(
  world: World, events: FightEvent[], caster: Entity, target: Entity, elements: readonly SkillElement[], from: Vec3,
  factor = 1,
): void {
  const s = world.require(target, Statuses), body = world.require(target, Body), enemy = world.get(target, Enemy);
  const d = skillPower(world, caster);
  if (elements.length === 0) {
    damage(world, events, caster, target, SKILL_EFFECTS.plain.damage * d * factor);
    return;
  }
  const has = (element: SkillElement) => elements.includes(element);
  const cursedBefore = statusOn(s.on, "cursed") && { ...statusOn(s.on, "cursed")! };
  // Statuses go on first, then reactions are checked against the result, in this order.

  if (has("fire")) applyStatus(s.on, "burning", E.fire.burnTime, E.fire.burnDamagePerSec * d);
  if (has("water")) applyStatus(s.on, "wet", E.water.wetTime);
  if (has("earth")) {
    applyStatus(s.on, "rooted", E.earth.rootTime);
    if (enemy) enemy.poise -= E.earth.poiseDamage * factor;
  }
  const knockback = knockbackOf(world, target, E.air.knockbackSpeed * factor);
  if (has("air") && knockback > 0) knock(body.pos, from, body.vel, knockback);
  if (has("lightning")) applyStatus(s.on, "shocked", E.lightning.shockTime);
  if (has("light")) applyStatus(s.on, "marked", E.light.markTime);
  if (has("darkness")) applyStatus(s.on, "cursed", E.darkness.curseTime);

  let lightningFactor = 1;
  let arcs: { count: number; range: number; share: number } = { count: 1, range: E.lightning.arcRange, share: E.lightning.arcShare };
  if (has("lightning") && timeLeft(s.on, "wet") > 0 && s.cooldown.conduct <= 0) {
    s.cooldown.conduct = R.conduct.cooldown;
    endStatus(s.on, "wet");
    lightningFactor = R.conduct.lightningFactor;
    arcs = { count: R.conduct.arcs, range: R.conduct.arcRange, share: R.conduct.arcShare };
  }
  const doused = (has("fire") && timeLeft(s.on, "wet") > 0) || (has("water") && timeLeft(s.on, "burning") > 0);
  if (doused && s.cooldown.doused <= 0) {
    s.cooldown.doused = R.doused.cooldown;
    endStatus(s.on, "burning");
    endStatus(s.on, "wet");
  }
  const burning = statusOn(s.on, "burning");
  if (has("air") && burning && s.cooldown.fanned <= 0) {
    s.cooldown.fanned = R.fanned.cooldown;
    burning.amount *= R.fanned.burnFactor;
    const [next] = foesNear(world, caster, body.pos, R.fanned.spreadRange, target);
    if (next !== undefined) applyStatus(world.require(next, Statuses).on, "burning", burning.left, burning.amount);
  }
  let eclipse = false;
  if (has("darkness") && timeLeft(s.on, "marked") > 0 && s.cooldown.eclipse <= 0) {
    s.cooldown.eclipse = R.eclipse.cooldown;
    endStatus(s.on, "marked");
    endStatus(s.on, "cursed");
    if (cursedBefore) s.on.push(cursedBefore);
    eclipse = true;
  }

  const shareOf = (element: SkillElement) =>
    E[element].damage * d * factor * (element === "lightning" ? lightningFactor : 1) * resisted(world, target, element);
  damage(world, events, caster, target, elements.reduce((sum, element) => sum + shareOf(element), 0));
  if (has("darkness")) heal(world, caster, shareOf("darkness") * E.darkness.healShare);
  if (has("lightning")) {
    const arc = E.lightning.damage * d * factor * lightningFactor * arcs.share;
    for (const next of foesNear(world, caster, body.pos, arcs.range, target).slice(0, arcs.count)) {
      damage(world, events, caster, next, arc * resisted(world, next, "lightning"));
    }
  }
  if (eclipse) {
    for (const near of foesNear(world, caster, body.pos, R.eclipse.radius)) {
      damage(world, events, caster, near, R.eclipse.damage * d * factor * resisted(world, near, "darkness"));
    }
  }
  if (stacksOf(s.on, "shocked") >= maxStacksOf("shocked")) {
    endStatus(s.on, "shocked");
    if (enemy && world.require(target, Health).hp > 0) {
      const time = stunTime(E.lightning.stunTime, world.require(target, FighterStats));
      stun(world, target, enemy, "stunned", time * modsOf(world, target).stunTimeFactor);
    }
  }
}
