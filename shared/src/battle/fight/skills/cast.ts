import type { Entity, System, World } from "../../../core/ecs.js";
import { FIXED_DT } from "../../../core/time.js";
import { clamp, nextRandom, wrapAngle, type Vec2, type Vec3 } from "../../../core/math.js";
import { HARMFUL_STATUSES, SKILL_EFFECTS, MAX_LIVE_SHOTS, shotOf } from "../../../skills/effects.js";
import {
  releaseTime, SAVE_IN_FIGHT_TIME, SKILL, skillCost, type Segment, type Skill,
} from "../../../skills/skill.js";
import {
  Body, Fighter, Health, Player, SkillObject, Stamina, Statuses, type PlayerData, type SkillObjectData,
} from "../../components.js";
import { PlayerInput } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats, skillDamage } from "../../stats.js";
import type { FightContext } from "../context.js";
import { heal } from "./statuses.js";
import { foesNear, strike } from "./strike.js";

// Timers are float seconds counted down by FIXED_DT: this keeps 1 / (1/60) steps from becoming 61.
const EPS = 1e-6;

const stepsOf = (seconds: number): number => Math.round(seconds / FIXED_DT);

export function imbueOf(world: World, caster: Entity): [Entity, SkillObjectData] | undefined {
  for (const row of world.query(SkillObject)) if (row[1].kind === "imbue" && row[1].caster === caster) return row;
  return undefined;
}

export function skillSystem(ctx: FightContext): System {
  return (world, dt) => {
    for (const event of ctx.events.slice()) {
      if (event.type === "hit" && event.weapon && event.team === "enemy") imbueHit(ctx, event.by, event.target);
    }
    for (const [e, player, stamina, body] of world.query(Player, Stamina, Body)) {
      const { writing } = player;
      if (player.action === "write" && writing && stepsOf(player.actionTime) >= stepsOf(SAVE_IN_FIGHT_TIME)) {
        player.book = player.book.map((page, i) => (i === writing.page ? writing.skill : page));
        const back = world.require(e, PlayerInput).chant ? "chant" : "bag";
        Object.assign(player, { action: back, actionTime: 0, writing: null });
        ctx.events.push({ type: "pageWritten", player: e, page: writing.page });
      }
      const skill = player.casting;
      if (player.action !== "cast" || !skill || stepsOf(player.actionTime) < stepsOf(releaseTime(skill))) continue;
      player.action = "none";
      player.casting = null;
      stamina.value = Math.max(0, stamina.value - skillCost(skill));
      stamina.regenDelay = PLAYER.staminaRegenDelay;
      release(ctx, e, skill, 0, { ...body.pos }, null, null);
    }
    for (const [e, o] of world.query(SkillObject)) {
      if (o.kind === "bolt") fly(ctx, e, o);
      else if (o.kind === "beam") stream(ctx, e, o, dt);
      else if (o.kind === "cloud") linger(ctx, e, o, dt);
      else {
        o.left -= dt;
        if (o.left > EPS) continue;
        world.destroy(e);
        if (o.kind === "wait") release(ctx, o.caster, o.skill, o.segment + 1, o.pos, o.dir, o.ignore);
        else handOff(ctx, o.caster, o.skill, o.segment, { ...world.require(o.caster, Body).pos }, null, null);
      }
    }
  };
}

type NewObject = Partial<SkillObjectData>
  & Pick<SkillObjectData, "kind" | "caster" | "skill" | "segment" | "pos" | "dir">;

const liveShots = (world: World): number => [...world.query(SkillObject)].length;

function spawn(ctx: FightContext, o: NewObject): SkillObjectData | null {
  if (liveShots(ctx.world) >= MAX_LIVE_SHOTS) return null;
  return ctx.world.add(ctx.world.spawn(), SkillObject, {
    flownM: 0, reachM: 0, left: 0, tickLeft: 0, hitsLeft: 0, held: false, target: null, fanM: { x: 0, z: 0 },
    climbPerM: 0, climbUntilM: 0,
    ignore: null, ...o, pos: { ...o.pos }, dir: { ...o.dir },
  });
}

function handOff(
  ctx: FightContext, caster: Entity, skill: Skill, index: number, from: Vec3, dir: Vec2 | null, ignore: Entity | null,
): void {
  const { delayTime } = shotOf(skill.segments[index]!);
  if (delayTime === 0) {
    release(ctx, caster, skill, index + 1, from, dir, ignore);
    return;
  }
  spawn(ctx, {
    kind: "wait", caster, skill, segment: index, pos: from, dir: dir ?? { x: 0, z: 0 }, ignore,
    left: delayTime,
  });
}

function release(
  ctx: FightContext, caster: Entity, skill: Skill, index: number, from: Vec3, dir: Vec2 | null, ignore: Entity | null,
): void {
  const segment = skill.segments[index];
  const { world, events } = ctx;
  if (!segment || world.require(caster, Health).hp <= 0) return;
  const input = world.require(caster, PlayerInput);
  // A zero direction is a directionless segment's, kept through a Delay: the caster's aim as it fires.
  const aim = dir && (dir.x !== 0 || dir.z !== 0) ? dir : { x: input.aimX, z: input.aimZ };
  const shot = shotOf(segment);
  const base = { caster, skill, segment: index, pos: from, dir: aim, ignore };
  switch (segment.form) {
    case "bolt": {
      const count = Math.min(shot.bolts, MAX_LIVE_SHOTS - liveShots(world));
      const lock = input.locked === null ? undefined : ctx.enemies[input.locked];
      const target = shot.followTurnRadPerSec === 0 ? null
        : lock !== undefined && lock !== ignore && world.require(lock, Health).hp > 0 ? lock
        : foesNear(world, caster, from, Infinity, ignore ?? undefined)[0] ?? null;
      if (count === 1) {
        spawn(ctx, { ...base, kind: "bolt", target, hitsLeft: shot.pierceTargets, reachM: shot.boltRadiusM });
        return;
      }
      const aimGapM = Math.min(
        SKILL_EFFECTS.bolt.followGapRadii * shot.boltRadiusM, SKILL_EFFECTS.bolt.followRowMaxM / Math.max(1, count - 1),
      );
      const wallM = ctx.arena.radius - shot.boltRadiusM;
      for (const bolt of splitBolts(world.require(caster, Player), from, aim, count, wallM)) {
        const side = bolt.slot - (count - 1) / 2;
        spawn(ctx, {
          ...base, kind: "bolt", pos: bolt.pos, dir: bolt.dir, climbPerM: bolt.climbPerM, climbUntilM: bolt.climbUntilM,
          target, hitsLeft: shot.pierceTargets, reachM: shot.boltRadiusM,
          fanM: { x: aim.z * side * aimGapM, z: -aim.x * side * aimGapM },
        });
      }
      return;
    }
    case "beam": {
      const player = index === 0 ? world.get(caster, Player) : undefined;
      const beam = spawn(ctx, {
        ...base, kind: "beam", held: player?.castHeld ?? false,
        left: SKILL_EFFECTS.beam.time * shot.longerFactor, tickLeft: 0,
      });
      if (!beam) return;
      if (player) Object.assign(player, { action: "beam", actionTime: 0 });
      tickBeam(ctx, beam);
      return;
    }
    case "nova": {
      const radiusM = SKILL_EFFECTS.nova.radius * shot.widenFactor;
      pulse(ctx, caster, segment, from, radiusM, shot.damageFactor);
      events.push({ type: "skill", form: "nova", elements: segment.elements, at: { ...from }, radiusM });
      if (shot.cloudTime > 0) {
        const clouds = [...world.query(SkillObject)].filter(([, o]) => o.kind === "cloud");
        const mine = clouds.filter(([, o]) => o.caster === caster);
        if (mine.length >= SKILL_EFFECTS.objects.perPlayer) world.destroy(mine[0]![0]);
        else if (clouds.length >= SKILL_EFFECTS.objects.perFight) world.destroy(clouds[0]![0]);
        spawn(ctx, {
          ...base, kind: "cloud", reachM: radiusM, left: shot.cloudTime, tickLeft: SKILL_EFFECTS.cloud.tickTime,
        });
      }
      break;
    }
    case "imbue": {
      const old = imbueOf(world, caster);
      if (old) world.destroy(old[0]);
      const at = world.require(caster, Body).pos;
      const hitsLeft = Math.round(SKILL_EFFECTS.imbue.hits * shot.longerFactor);
      spawn(ctx, { ...base, kind: "imbue", pos: at, hitsLeft, left: SKILL_EFFECTS.imbue.time * shot.longerFactor });
      events.push({ type: "skill", form: "imbue", elements: segment.elements, at: { ...at } });
      return;
    }
    case "self": {
      releaseOnSelf(world, caster, segment);
      const at = world.require(caster, Body).pos;
      events.push({ type: "skill", form: "self", elements: segment.elements, at: { ...at } });
      handOff(ctx, caster, skill, index, { ...at }, null, null);
      return;
    }
  }
  handOff(ctx, caster, skill, index, from, null, null);
}

interface SplitBolt { pos: Vec3; dir: Vec2; climbPerM: number; climbUntilM: number; slot: number }
interface Spot { side: number; up: number }

function splitBolts(player: PlayerData, from: Vec3, aim: Vec2, count: number, wallM: number): SplitBolt[] {
  const B = SKILL_EFFECTS.bolt;
  const roll = (): number => {
    const [value, next] = nextRandom(player.rng);
    player.rng = next;
    return value;
  };
  const inDisc = (radiusM: number): Spot => {
    const r = radiusM * Math.sqrt(roll()), a = 2 * Math.PI * roll();
    return { side: r * Math.cos(a), up: r * Math.sin(a) };
  };
  const ringM = clamp(B.splitRingPerRootM * Math.sqrt(count), B.splitRingMinM, B.splitRingMaxM);
  // The sides along the circle's line that stay inside the wall: -across ± halfM.
  const across = from.x * aim.z - from.z * aim.x;
  const halfM = Math.sqrt(Math.max(0, across ** 2 - (from.x ** 2 + from.z ** 2 - wallM ** 2)));
  const inArena = (spot: Spot): Spot => ({ ...spot, side: clamp(spot.side, -across - halfM, -across + halfM) });
  const spots: Spot[] = [];
  const roomM = (s: Spot) => Math.min(...spots.map((o) => Math.hypot(o.side - s.side, o.up - s.up)));
  for (let i = 0; i < count; i++) {
    let best = inArena(inDisc(ringM)), bestRoomM = roomM(best);
    for (let t = 1; t < B.splitSpotTries && spots.length > 0; t++) {
      const spot = inArena(inDisc(ringM)), spotRoomM = roomM(spot);
      if (spotRoomM > bestRoomM) [best, bestRoomM] = [spot, spotRoomM];
    }
    spots.push(best);
  }
  const centerY = Math.max(from.y, B.splitGroundM + ringM);
  const slots = spots.map((_, i) => i).sort((a, b) => spots[a]!.side - spots[b]!.side);
  return spots.map((spot, i) => {
    const pos = { x: from.x + aim.z * spot.side, y: centerY + spot.up, z: from.z - aim.x * spot.side };
    const off = inDisc(B.splitJitterM);
    const to = {
      x: from.x + aim.x * B.splitFocusM + aim.z * off.side,
      y: Math.max(B.splitGroundM, from.y + off.up),
      z: from.z + aim.z * B.splitFocusM - aim.x * off.side,
    };
    const flatM = Math.hypot(to.x - pos.x, to.z - pos.z);
    return {
      pos, dir: { x: (to.x - pos.x) / flatM, z: (to.z - pos.z) / flatM },
      climbPerM: (to.y - pos.y) / flatM, climbUntilM: flatM, slot: slots.indexOf(i),
    };
  });
}

function pulse(ctx: FightContext, caster: Entity, segment: Segment, at: Vec3, radiusM: number, factor: number): void {
  for (const target of foesNear(ctx.world, caster, at, radiusM)) {
    strike(ctx.world, ctx.events, caster, target, segment.elements, at, factor);
  }
}

function linger(ctx: FightContext, e: Entity, o: SkillObjectData, dt: number): void {
  o.left -= dt;
  o.tickLeft -= dt;
  const segment = o.skill.segments[o.segment]!;
  if (o.tickLeft <= EPS) {
    o.tickLeft += SKILL_EFFECTS.cloud.tickTime;
    pulse(ctx, o.caster, segment, o.pos, o.reachM, SKILL_EFFECTS.cloud.tickShare * shotOf(segment).damageFactor);
  }
  if (o.left <= EPS) ctx.world.destroy(e);
}

function imbueHit(ctx: FightContext, by: Entity, target: Entity): void {
  const { world } = ctx;
  const imbue = imbueOf(world, by);
  if (!imbue) return;
  const [e, o] = imbue, segment = o.skill.segments[o.segment]!;
  const from = world.require(by, Body).pos, at = world.require(target, Body).pos;
  const share = SKILL_EFFECTS.imbue.share * shotOf(segment).damageFactor;
  strike(world, ctx.events, by, target, segment.elements, from, share);
  if (--o.hitsLeft > 0) return;
  world.destroy(e);
  const dx = at.x - from.x, dz = at.z - from.z, len = Math.hypot(dx, dz) || 1;
  handOff(ctx, by, o.skill, o.segment, { ...at }, { x: dx / len, z: dz / len }, target);
}

function toWall(ctx: FightContext, pos: Vec3, dir: Vec2): number {
  const along = pos.x * dir.x + pos.z * dir.z;
  return -along + Math.sqrt(Math.max(0, along * along - (pos.x * pos.x + pos.z * pos.z - ctx.arena.radius ** 2)));
}

function stream(ctx: FightContext, e: Entity, o: SkillObjectData, dt: number): void {
  const { world } = ctx;
  const segment = o.skill.segments[o.segment]!;
  const player = o.segment === 0 ? world.get(o.caster, Player) : undefined;
  if (player) {
    if (player.action !== "beam") {
      world.destroy(e);
      return;
    }
    const input = world.require(o.caster, PlayerInput), stamina = world.require(o.caster, Stamina);
    Object.assign(o.pos, world.require(o.caster, Body).pos);
    o.dir = { x: input.aimX, z: input.aimZ };
    if (o.held && (!player.castHeld || stamina.value <= 0)) o.held = false;
    if (o.held) {
      const words = SKILL.cost.form + segment.elements.length * SKILL.cost.element
        + segment.modifiers.length * SKILL.cost.modifier;
      stamina.value = Math.max(0, stamina.value - words * SKILL_EFFECTS.beam.heldCostFactor * dt);
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
  handOff(ctx, o.caster, o.skill, o.segment, end, o.dir, hits.at(-1) ?? null);
}

function tickBeam(ctx: FightContext, o: SkillObjectData): Entity[] {
  const { world } = ctx;
  const segment = o.skill.segments[o.segment]!;
  const shot = shotOf(segment);
  const radiusM = SKILL_EFFECTS.beam.radiusM * shot.widenFactor;
  const maxHits = 1 + shot.pierceTargets;
  const rangeM = Math.min(SKILL_EFFECTS.beam.rangeM, toWall(ctx, o.pos, o.dir));
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
    o.tickLeft += SKILL_EFFECTS.beam.tickTime / shot.swiftFactor;
    for (const { e } of hits) {
      strike(world, ctx.events, o.caster, e, segment.elements, o.pos, SKILL_EFFECTS.beam.tickShare * shot.damageFactor);
    }
  }
  return hits.map(({ e }) => e);
}

function fly(ctx: FightContext, e: Entity, o: SkillObjectData): void {
  const { world } = ctx;
  const { pos } = o;
  const segment = o.skill.segments[o.segment]!;
  const shot = shotOf(segment);
  const follow = shot.followTurnRadPerSec;
  if (follow > 0 && (o.target === null || world.require(o.target, Health).hp <= 0)) {
    o.target = foesNear(world, o.caster, pos, Infinity, o.ignore ?? undefined)[0] ?? null;
  }
  if (follow > 0 && o.target !== null) {
    const to = world.require(o.target, Body).pos, maxTurnRad = follow * FIXED_DT;
    const fan = Math.min(1, Math.hypot(to.x - pos.x, to.z - pos.z) / SKILL_EFFECTS.bolt.followMergeM);
    const toX = to.x + o.fanM.x * fan - pos.x, toZ = to.z + o.fanM.z * fan - pos.z;
    const have = Math.atan2(o.dir.x, o.dir.z);
    const turned = have + clamp(wrapAngle(Math.atan2(toX, toZ) - have), -maxTurnRad, maxTurnRad);
    o.dir = { x: Math.sin(turned), z: Math.cos(turned) };
  }
  const { dir } = o;
  const speedMps = SKILL_EFFECTS.bolt.speedMps * shot.swiftFactor;
  let travel = Math.min(speedMps * FIXED_DT, SKILL_EFFECTS.bolt.rangeM - o.flownM);
  let done = travel >= SKILL_EFFECTS.bolt.rangeM - o.flownM;
  const wallM = toWall(ctx, pos, dir);
  if (wallM <= travel) { travel = Math.max(0, wallM); done = true; }

  let hit: Entity | null = null;
  const team = world.require(o.caster, Fighter).team;
  for (const [target, fighter, health, body] of world.query(Fighter, Health, Body)) {
    if (fighter.team === team || health.hp <= 0 || target === o.ignore) continue;
    const fx = pos.x - body.pos.x, fz = pos.z - body.pos.z, reach = fighter.radius + o.reachM;
    const b = fx * dir.x + fz * dir.z, c = fx * fx + fz * fz - reach * reach;
    const disc = b * b - c;
    if (disc < 0 || (c <= 0 && b > 0)) continue;
    const t = c <= 0 ? 0 : -b - Math.sqrt(disc);
    if (t < 0 || t > travel) continue;
    travel = t;
    hit = target;
  }

  pos.x += dir.x * travel;
  pos.y += o.climbPerM * clamp(o.climbUntilM - o.flownM, 0, travel);
  pos.z += dir.z * travel;
  o.flownM += travel;
  if (hit === null && !done) return;
  if (hit !== null) strike(world, ctx.events, o.caster, hit, segment.elements, pos, shot.damageFactor);
  if (hit !== null && o.hitsLeft > 0 && !done) {
    o.hitsLeft--;
    o.ignore = hit;
    return;
  }
  world.destroy(e);
  handOff(ctx, o.caster, o.skill, o.segment, { ...pos }, dir, hit);
}

function releaseOnSelf(world: World, caster: Entity, segment: Segment): void {
  const s = world.require(caster, Statuses);
  const shot = shotOf(segment);
  const d = skillDamage(SKILL_EFFECTS.damage, world.require(caster, FighterStats)) * shot.damageFactor;
  for (const element of segment.elements) {
    const self = SKILL_EFFECTS.self[element];
    if (self.status) s.left[self.status] = self.time * shot.longerFactor;
    if (element === "light") s.shield = SKILL_EFFECTS.self.light.shield * d;
    if (element === "water") {
      for (const status of HARMFUL_STATUSES) s.left[status] = 0;
      s.burnDamagePerSec = s.shocks = 0;
      heal(world, caster, SKILL_EFFECTS.self.water.heal * d);
    }
  }
}
