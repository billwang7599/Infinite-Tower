import type { Entity, System, World } from "../../../core/ecs.js";
import { FIXED_DT } from "../../../core/time.js";
import { clamp, wrapAngle, type Vec2, type Vec3 } from "../../../core/math.js";
import { augmentStrength, HARMFUL_STATUSES, MAGIC } from "../../../spells/effects.js";
import {
  castTime, SAVE_IN_FIGHT_TIME, SPELL, spellCost, type Augment, type Segment, type Spell,
} from "../../../spells/spell.js";
import {
  Body, Fighter, Health, Player, SpellObject, Stamina, Statuses, type SpellObjectData,
} from "../../components.js";
import { PlayerInput } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats, spellDamage } from "../../stats.js";
import type { FightContext } from "../context.js";
import { heal } from "./statuses.js";
import { foesNear, strike } from "./strike.js";

const A = MAGIC.augments;
// Timers are float seconds counted down by FIXED_DT: this keeps 1 / (1/60) steps from becoming 61.
const EPS = 1e-6;

const stepsOf = (seconds: number): number => Math.round(seconds / FIXED_DT);
const power = (segment: Segment): number => 1 + A.amplify * augmentStrength(segment.augments, "amplify");

export function imbueOf(world: World, caster: Entity): [Entity, SpellObjectData] | undefined {
  for (const row of world.query(SpellObject)) if (row[1].kind === "imbue" && row[1].caster === caster) return row;
  return undefined;
}

export function spellSystem(ctx: FightContext): System {
  return (world, dt) => {
    for (const event of ctx.events.slice()) {
      if (event.type === "hit" && event.sword && event.team === "enemy") imbueHit(ctx, event.by, event.target);
    }
    for (const [e, player, stamina, body] of world.query(Player, Stamina, Body)) {
      const { writing } = player;
      if (player.action === "write" && writing && stepsOf(player.actionTime) >= stepsOf(SAVE_IN_FIGHT_TIME)) {
        player.book = player.book.map((page, i) => (i === writing.page ? writing.spell : page));
        const back = world.require(e, PlayerInput).chant ? "chant" : "bag";
        Object.assign(player, { action: back, actionTime: 0, writing: null });
        ctx.events.push({ type: "pageWritten", player: e, page: writing.page });
      }
      const spell = player.casting;
      if (player.action !== "cast" || !spell || stepsOf(player.actionTime) < stepsOf(castTime(spell))) continue;
      player.action = "none";
      player.casting = null;
      stamina.value = Math.max(0, stamina.value - spellCost(spell));
      stamina.regenDelay = PLAYER.staminaRegenDelay;
      fire(ctx, e, spell, 0, { ...body.pos }, null, null);
    }
    for (const [e, o] of world.query(SpellObject)) {
      if (o.kind === "bolt") fly(ctx, e, o);
      else if (o.kind === "beam") stream(ctx, e, o, dt);
      else if (o.kind === "cloud") linger(ctx, e, o, dt);
      else {
        o.left -= dt;
        if (o.left > EPS) continue;
        world.destroy(e);
        if (o.kind === "wait") fire(ctx, o.caster, o.spell, o.segment + 1, o.pos, o.dir, o.ignore);
        else handOff(ctx, o.caster, o.spell, o.segment, { ...world.require(o.caster, Body).pos }, null, null);
      }
    }
  };
}

type NewObject = Partial<SpellObjectData>
  & Pick<SpellObjectData, "kind" | "caster" | "spell" | "segment" | "pos" | "dir">;

function spawn(ctx: FightContext, o: NewObject): SpellObjectData {
  return ctx.world.add(ctx.world.spawn(), SpellObject, {
    flownM: 0, reachM: 0, left: 0, tickLeft: 0, hitsLeft: 0, held: false, target: null, ignore: null, ...o,
    pos: { ...o.pos }, dir: { ...o.dir },
  });
}

function handOff(
  ctx: FightContext, caster: Entity, spell: Spell, index: number, from: Vec3, dir: Vec2 | null, ignore: Entity | null,
): void {
  const delay = augmentStrength(spell.segments[index]!.augments, "delay");
  if (delay === 0) {
    fire(ctx, caster, spell, index + 1, from, dir, ignore);
    return;
  }
  spawn(ctx, {
    kind: "wait", caster, spell, segment: index, pos: from, dir: dir ?? { x: 0, z: 0 }, ignore,
    left: A.delayTime * delay,
  });
}

function fire(
  ctx: FightContext, caster: Entity, spell: Spell, index: number, from: Vec3, dir: Vec2 | null, ignore: Entity | null,
): void {
  const segment = spell.segments[index];
  const { world, events } = ctx;
  if (!segment || world.require(caster, Health).hp <= 0) return;
  const input = world.require(caster, PlayerInput);
  // A zero direction is a directionless segment's, kept through a Delay: the caster's aim as it fires.
  const aim = dir && (dir.x !== 0 || dir.z !== 0) ? dir : { x: input.aimX, z: input.aimZ };
  const strength = (augment: Augment) => augmentStrength(segment.augments, augment);
  const base = { caster, spell, segment: index, pos: from, dir: aim, ignore };
  switch (segment.form) {
    case "bolt": {
      const count = 1 + Math.round(A.splitBolts * strength("split"));
      const lock = input.locked === null ? undefined : ctx.enemies[input.locked];
      const target = strength("follow") === 0 ? null
        : lock !== undefined && lock !== ignore && world.require(lock, Health).hp > 0 ? lock
        : foesNear(world, caster, from, Infinity, ignore ?? undefined)[0] ?? null;
      const yaw = Math.atan2(aim.x, aim.z);
      for (let i = 0; i < count; i++) {
        const turned = yaw + (i - (count - 1) / 2) * MAGIC.bolt.splitSpreadRad;
        const boltDir = count === 1 ? aim : { x: Math.sin(turned), z: Math.cos(turned) };
        const hitsLeft = Math.round(A.pierceTargets * strength("pierce"));
        spawn(ctx, { ...base, kind: "bolt", dir: boltDir, target, hitsLeft });
      }
      return;
    }
    case "beam": {
      const player = index === 0 ? world.get(caster, Player) : undefined;
      if (player) Object.assign(player, { action: "beam", actionTime: 0 });
      const beam = spawn(ctx, {
        ...base, kind: "beam", held: player !== undefined && input.cast !== null,
        left: MAGIC.beam.time * (1 + A.extend * strength("extend")), tickLeft: 0,
      });
      tickBeam(ctx, beam);
      return;
    }
    case "nova": {
      const radiusM = MAGIC.nova.radius * (1 + A.widen * strength("widen"));
      pulse(ctx, caster, segment, from, radiusM, power(segment));
      events.push({ type: "spell", form: "nova", elements: segment.elements, at: { ...from }, radiusM });
      const extend = strength("extend");
      if (extend > 0) {
        const clouds = [...world.query(SpellObject)].filter(([, o]) => o.kind === "cloud");
        const mine = clouds.filter(([, o]) => o.caster === caster);
        if (mine.length >= MAGIC.objects.perPlayer) world.destroy(mine[0]![0]);
        else if (clouds.length >= MAGIC.objects.perFight) world.destroy(clouds[0]![0]);
        spawn(ctx, {
          ...base, kind: "cloud", reachM: radiusM, left: MAGIC.cloud.time * extend, tickLeft: MAGIC.cloud.tickTime,
        });
      }
      break;
    }
    case "imbue": {
      const old = imbueOf(world, caster);
      if (old) world.destroy(old[0]);
      const longer = 1 + A.extend * strength("extend");
      const at = world.require(caster, Body).pos;
      const hitsLeft = Math.round(MAGIC.imbue.hits * longer);
      spawn(ctx, { ...base, kind: "imbue", pos: at, hitsLeft, left: MAGIC.imbue.time * longer });
      events.push({ type: "spell", form: "imbue", elements: segment.elements, at: { ...at } });
      return;
    }
    case "self": {
      castOnSelf(world, caster, segment);
      const at = world.require(caster, Body).pos;
      events.push({ type: "spell", form: "self", elements: segment.elements, at: { ...at } });
      handOff(ctx, caster, spell, index, { ...at }, null, null);
      return;
    }
  }
  handOff(ctx, caster, spell, index, from, null, null);
}

function pulse(ctx: FightContext, caster: Entity, segment: Segment, at: Vec3, radiusM: number, factor: number): void {
  for (const target of foesNear(ctx.world, caster, at, radiusM)) {
    strike(ctx.world, ctx.events, caster, target, segment.elements, at, factor);
  }
}

function linger(ctx: FightContext, e: Entity, o: SpellObjectData, dt: number): void {
  o.left -= dt;
  o.tickLeft -= dt;
  const segment = o.spell.segments[o.segment]!;
  if (o.tickLeft <= EPS) {
    o.tickLeft += MAGIC.cloud.tickTime;
    pulse(ctx, o.caster, segment, o.pos, o.reachM, MAGIC.cloud.tickShare * power(segment));
  }
  if (o.left <= EPS) ctx.world.destroy(e);
}

function imbueHit(ctx: FightContext, by: Entity, target: Entity): void {
  const { world } = ctx;
  const imbue = imbueOf(world, by);
  if (!imbue) return;
  const [e, o] = imbue, segment = o.spell.segments[o.segment]!;
  const from = world.require(by, Body).pos, at = world.require(target, Body).pos;
  strike(world, ctx.events, by, target, segment.elements, from, MAGIC.imbue.share * power(segment));
  if (--o.hitsLeft > 0) return;
  world.destroy(e);
  const dx = at.x - from.x, dz = at.z - from.z, len = Math.hypot(dx, dz) || 1;
  handOff(ctx, by, o.spell, o.segment, { ...at }, { x: dx / len, z: dz / len }, target);
}

function toWall(ctx: FightContext, pos: Vec3, dir: Vec2): number {
  const along = pos.x * dir.x + pos.z * dir.z;
  return -along + Math.sqrt(Math.max(0, along * along - (pos.x * pos.x + pos.z * pos.z - ctx.arena.radius ** 2)));
}

function stream(ctx: FightContext, e: Entity, o: SpellObjectData, dt: number): void {
  const { world } = ctx;
  const segment = o.spell.segments[o.segment]!;
  const player = o.segment === 0 ? world.get(o.caster, Player) : undefined;
  if (player) {
    if (player.action !== "beam") {
      world.destroy(e);
      return;
    }
    const input = world.require(o.caster, PlayerInput), stamina = world.require(o.caster, Stamina);
    Object.assign(o.pos, world.require(o.caster, Body).pos);
    o.dir = { x: input.aimX, z: input.aimZ };
    if (o.held && (input.cast === null || stamina.value <= 0)) o.held = false;
    if (o.held) {
      const words = SPELL.cost.form + segment.elements.length * SPELL.cost.element
        + segment.augments.length * SPELL.cost.augment;
      stamina.value = Math.max(0, stamina.value - words * MAGIC.beam.heldCostFactor * dt);
      stamina.regenDelay = PLAYER.staminaRegenDelay;
    }
  }
  if (!o.held) o.left -= dt;
  o.tickLeft -= dt;
  const hits = tickBeam(ctx, o);
  if (o.left > EPS) return;
  world.destroy(e);
  if (player) player.action = "none";
  const end = { x: o.pos.x + o.dir.x * o.reachM, y: o.pos.y, z: o.pos.z + o.dir.z * o.reachM };
  handOff(ctx, o.caster, o.spell, o.segment, end, o.dir, hits.at(-1) ?? null);
}

function tickBeam(ctx: FightContext, o: SpellObjectData): Entity[] {
  const { world } = ctx;
  const segment = o.spell.segments[o.segment]!;
  const strength = (augment: Augment) => augmentStrength(segment.augments, augment);
  const radiusM = MAGIC.beam.radiusM * (1 + A.widen * strength("widen"));
  const maxHits = 1 + Math.round(A.pierceTargets * strength("pierce"));
  const rangeM = Math.min(MAGIC.beam.rangeM, toWall(ctx, o.pos, o.dir));
  const team = world.require(o.caster, Fighter).team;
  const onLine: { e: Entity; t: number }[] = [];
  for (const [target, fighter, health, body] of world.query(Fighter, Health, Body)) {
    if (fighter.team === team || health.hp <= 0) continue;
    const fx = body.pos.x - o.pos.x, fz = body.pos.z - o.pos.z, reach = fighter.radius + radiusM;
    const along = fx * o.dir.x + fz * o.dir.z, side = fx * o.dir.z - fz * o.dir.x;
    if (Math.abs(side) > reach || along < -fighter.radius) continue;
    const t = Math.max(0, along - Math.sqrt(reach * reach - side * side));
    if (t <= rangeM) onLine.push({ e: target, t });
  }
  const hits = onLine.sort((a, b) => a.t - b.t).slice(0, maxHits);
  o.reachM = hits.length === maxHits ? hits.at(-1)!.t : rangeM;
  if (o.tickLeft <= EPS) {
    o.tickLeft += MAGIC.beam.tickTime / (1 + A.swift * strength("swift"));
    for (const { e } of hits) {
      strike(world, ctx.events, o.caster, e, segment.elements, o.pos, MAGIC.beam.tickShare * power(segment));
    }
  }
  return hits.map(({ e }) => e);
}

function fly(ctx: FightContext, e: Entity, o: SpellObjectData): void {
  const { world } = ctx;
  const { pos } = o;
  const segment = o.spell.segments[o.segment]!;
  const strength = (augment: Augment) => augmentStrength(segment.augments, augment);
  const follow = strength("follow");
  if (follow > 0 && (o.target === null || world.require(o.target, Health).hp <= 0)) {
    o.target = foesNear(world, o.caster, pos, Infinity, o.ignore ?? undefined)[0] ?? null;
  }
  if (follow > 0 && o.target !== null) {
    const to = world.require(o.target, Body).pos, maxTurnRad = follow * A.followTurnRadPerSec * FIXED_DT;
    const have = Math.atan2(o.dir.x, o.dir.z);
    const turned = have + clamp(wrapAngle(Math.atan2(to.x - pos.x, to.z - pos.z) - have), -maxTurnRad, maxTurnRad);
    o.dir = { x: Math.sin(turned), z: Math.cos(turned) };
  }
  const { dir } = o;
  const speedMps = MAGIC.bolt.speedMps * (1 + A.swift * strength("swift"));
  let travel = Math.min(speedMps * FIXED_DT, MAGIC.bolt.rangeM - o.flownM);
  let done = travel >= MAGIC.bolt.rangeM - o.flownM;
  const wallM = toWall(ctx, pos, dir);
  if (wallM <= travel) { travel = Math.max(0, wallM); done = true; }

  let hit: Entity | null = null;
  const team = world.require(o.caster, Fighter).team;
  for (const [target, fighter, health, body] of world.query(Fighter, Health, Body)) {
    if (fighter.team === team || health.hp <= 0 || target === o.ignore) continue;
    const fx = pos.x - body.pos.x, fz = pos.z - body.pos.z, reach = fighter.radius + MAGIC.bolt.radiusM;
    const b = fx * dir.x + fz * dir.z, c = fx * fx + fz * fz - reach * reach;
    const disc = b * b - c;
    if (disc < 0 || (c <= 0 && b > 0)) continue;
    const t = c <= 0 ? 0 : -b - Math.sqrt(disc);
    if (t < 0 || t > travel) continue;
    travel = t;
    hit = target;
  }

  pos.x += dir.x * travel;
  pos.z += dir.z * travel;
  o.flownM += travel;
  if (hit === null && !done) return;
  const factor = power(segment) * (strength("split") > 0 ? MAGIC.bolt.splitShare : 1);
  if (hit !== null) strike(world, ctx.events, o.caster, hit, segment.elements, pos, factor);
  if (hit !== null && o.hitsLeft > 0 && !done) {
    o.hitsLeft--;
    o.ignore = hit;
    return;
  }
  world.destroy(e);
  handOff(ctx, o.caster, o.spell, o.segment, { ...pos }, dir, hit);
}

function castOnSelf(world: World, caster: Entity, segment: Segment): void {
  const s = world.require(caster, Statuses);
  const d = spellDamage(MAGIC.damage, world.require(caster, FighterStats)) * power(segment);
  const longer = 1 + A.extend * augmentStrength(segment.augments, "extend");
  for (const element of segment.elements) {
    const self = MAGIC.self[element];
    if (self.status) s.left[self.status] = self.time * longer;
    if (element === "light") s.shield = MAGIC.self.light.shield * d;
    if (element === "water") {
      for (const status of HARMFUL_STATUSES) s.left[status] = 0;
      s.burnDamagePerSec = s.shocks = 0;
      heal(world, caster, MAGIC.self.water.heal * d);
    }
  }
}
