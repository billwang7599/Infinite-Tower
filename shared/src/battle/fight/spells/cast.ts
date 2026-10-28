import type { Entity, System, World } from "../../../core/ecs.js";
import { FIXED_DT } from "../../../core/time.js";
import type { Vec2, Vec3 } from "../../../core/math.js";
import { HARMFUL_STATUSES, MAGIC } from "../../../spells/effects.js";
import { castTime, spellCost, type Spell, type SpellElement } from "../../../spells/spell.js";
import { Body, Fighter, Health, Player, SpellShot, Stamina, Statuses, type SpellShotData } from "../../components.js";
import { PlayerInput } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats, spellDamage } from "../../stats.js";
import type { FightContext } from "../context.js";
import { heal } from "./statuses.js";
import { foesNear, strike } from "./strike.js";

const stepsOf = (seconds: number): number => Math.round(seconds / FIXED_DT);

export function spellSystem(ctx: FightContext): System {
  return (world) => {
    for (const [e, player, stamina, body] of world.query(Player, Stamina, Body)) {
      const spell = player.casting;
      if (player.action !== "cast" || !spell || stepsOf(player.actionTime) < stepsOf(castTime(spell))) continue;
      player.action = "none";
      player.casting = null;
      stamina.value = Math.max(0, stamina.value - spellCost(spell));
      stamina.regenDelay = PLAYER.staminaRegenDelay;
      fire(ctx, e, spell, 0, { ...body.pos }, null, null);
    }
    for (const [e, shot] of world.query(SpellShot)) fly(ctx, e, shot);
  };
}

function fire(
  ctx: FightContext, caster: Entity, spell: Spell, index: number, from: Vec3, dir: Vec2 | null, ignore: Entity | null,
): void {
  const segment = spell.segments[index];
  const { world, events } = ctx;
  if (!segment || world.require(caster, Health).hp <= 0) return;
  const input = world.require(caster, PlayerInput);
  switch (segment.form) {
    case "bolt": {
      const shot = { caster, spell, segment: index, pos: { ...from }, flownM: 0, ignore };
      world.add(world.spawn(), SpellShot, { ...shot, dir: dir ? { ...dir } : { x: input.aimX, z: input.aimZ } });
      return;
    }
    case "nova":
      for (const target of foesNear(world, caster, from, MAGIC.nova.radius)) {
        strike(world, events, caster, target, segment.elements, from);
      }
      events.push({ type: "spell", form: "nova", elements: segment.elements, at: { ...from } });
      break;
    case "self": {
      castOnSelf(world, caster, segment.elements);
      const at = world.require(caster, Body).pos;
      events.push({ type: "spell", form: "self", elements: segment.elements, at: { ...at } });
      fire(ctx, caster, spell, index + 1, { ...at }, null, null);
      return;
    }
    // Beam and Imbue aren't built yet: they complete at once.
    default:
      break;
  }
  fire(ctx, caster, spell, index + 1, from, null, null);
}

function fly(ctx: FightContext, e: Entity, shot: SpellShotData): void {
  const { world, arena } = ctx;
  const { pos, dir } = shot;
  let travel = Math.min(MAGIC.bolt.speedMps * FIXED_DT, MAGIC.bolt.rangeM - shot.flownM);
  let done = travel >= MAGIC.bolt.rangeM - shot.flownM;
  const along = pos.x * dir.x + pos.z * dir.z;
  const toWall = -along + Math.sqrt(Math.max(0, along * along - (pos.x * pos.x + pos.z * pos.z - arena.radius ** 2)));
  if (toWall <= travel) { travel = Math.max(0, toWall); done = true; }

  let hit: Entity | null = null;
  const team = world.require(shot.caster, Fighter).team;
  for (const [target, fighter, health, body] of world.query(Fighter, Health, Body)) {
    if (fighter.team === team || health.hp <= 0 || target === shot.ignore) continue;
    const fx = pos.x - body.pos.x, fz = pos.z - body.pos.z, reach = fighter.radius + MAGIC.bolt.radiusM;
    const b = fx * dir.x + fz * dir.z, c = fx * fx + fz * fz - reach * reach;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = c <= 0 ? 0 : -b - Math.sqrt(disc);
    if (t < 0 || t > travel) continue;
    travel = t;
    hit = target;
  }

  pos.x += dir.x * travel;
  pos.z += dir.z * travel;
  shot.flownM += travel;
  if (hit === null && !done) return;
  world.destroy(e);
  const elements = shot.spell.segments[shot.segment]!.elements;
  if (hit !== null) strike(world, ctx.events, shot.caster, hit, elements, pos);
  fire(ctx, shot.caster, shot.spell, shot.segment + 1, { ...pos }, dir, hit);
}

function castOnSelf(world: World, caster: Entity, elements: readonly SpellElement[]): void {
  const s = world.require(caster, Statuses);
  const d = spellDamage(MAGIC.damage, world.require(caster, FighterStats));
  for (const element of elements) {
    const self = MAGIC.self[element];
    if (self.status) s.left[self.status] = self.time;
    if (element === "light") s.shield = MAGIC.self.light.shield * d;
    if (element === "water") {
      for (const status of HARMFUL_STATUSES) s.left[status] = 0;
      s.burnDamagePerSec = s.shocks = 0;
      heal(world, caster, MAGIC.self.water.heal * d);
    }
  }
}
