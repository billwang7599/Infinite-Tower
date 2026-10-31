import {
  Body, Enemy, FIXED_DT, Health, ITEMS, Player, Skilled, SkillObject, weaponItemIn, Wielder,
  type AttackKind, type EnemyState, type Entity, type SkillObjectData, type SkillObjectKind, type Vec2, type Vec3,
  type World,
} from "@infinite-tower/shared";
import type { Fight, FightEvent } from "@infinite-tower/shared/fight";
import type { BattleContext } from "../modes/battle/context.js";
import { FiredEffects } from "../modes/battle/fired.js";
import type { FightSync } from "../modes/battle/sync.js";
import type { Ears, Hearing } from "./mix.js";
import { ARENA_AMBIENCE, ELEMENT_SOUNDS, ENEMY_SOUNDS, STEP_SOUNDS, type SoundName } from "./sounds.js";

export interface Cue { sound: SoundName; at: Vec2 | null; rate?: number; gain?: number }
export interface Heard { ears: Ears; hearing: Hearing; cues: Cue[]; loops: Map<string, Cue> }

export type FightToHear = Pick<BattleContext, "fight" | "events" | "view" | "outcome"> & {
  sync: Pick<FightSync, "stats"> | null;
};

export const ARENA_HEARING: Hearing = { near: 3, far: 30 };
export const STRIDE_M = 1.4;
const ENEMY_STEP_GAIN = 0.7;
const LAND_AFTER_AIR_TIME = 0.25;
// Begun longer ago than this when first heard (a fighter seen mid-wind-up, a stalled tab): let go unheard.
const MAX_LATE_STEPS = 12;
const FORGET_STEPS = 180;
// Moved further than this in a frame: put there by a resync, not walked.
const JUMPED_M = 1.5;
const CLOUD_GAIN = 0.5;
const WINDUPS: readonly EnemyState[] = ["weaponWindup", "lungeWindup", "chargeWindup"];

const HEAVY_VOICE = { rate: 0.85, gain: 1.25 } as const;
const FEINT_VOICE = { rate: 1.4, gain: 0.7 } as const;

export function swingVoice(massKg: number, attack: AttackKind): { rate: number; gain: number } {
  const heavier = massKg / ITEMS.sword.weight, heavy = attack === "heavy";
  return {
    rate: (heavy ? HEAVY_VOICE.rate : 1) / Math.sqrt(heavier), gain: heavier ** 0.25 * (heavy ? HEAVY_VOICE.gain : 1),
  };
}

const flat = (p: Vec3): Vec2 => ({ x: p.x, z: p.z });
const posOf = (world: World, e: Entity): Vec2 | null => {
  const body = world.get(e, Body);
  return body ? flat(body.pos) : null;
};
const elementOf = (o: SkillObjectData) => ELEMENT_SOUNDS[o.skill.segments[o.segment]?.elements[0] ?? "plain"];

function grunt(world: World, e: Entity): Cue[] {
  const enemy = world.get(e, Enemy);
  if (!enemy || enemy.state === "dead" || (world.get(e, Health)?.hp ?? 1) <= 0) return [];
  return [{ sound: ENEMY_SOUNDS[enemy.def.id].hurt, at: posOf(world, e) }];
}

type EventCues = { [T in FightEvent["type"]]?: (ev: Extract<FightEvent, { type: T }>, world: World) => Cue[] };
const EVENT_CUES: EventCues = {
  hit: (ev, world) => [
    { sound: ev.weapon ? "hit-blade" : "hit-body", at: posOf(world, ev.target) }, ...grunt(world, ev.target),
  ],
  slam: (ev, world) => [{ sound: "slam", at: posOf(world, ev.enemy) }],
  block: (ev, world) => [
    { sound: ev.perfect ? "parry" : "block", at: posOf(world, ev.target) },
    ...ev.broken ? [{ sound: "guard-break" as const, at: posOf(world, ev.target) }] : [],
  ],
  feint: (ev, world) => [{ sound: "draw-blade", at: posOf(world, ev.by), ...FEINT_VOICE }],
  skill(ev) {
    const el = ELEMENT_SOUNDS[ev.elements[0] ?? "plain"];
    return [{ sound: ev.form === "nova" ? el.impact : el.cast, at: flat(ev.at), rate: el.rate }];
  },
  pageWritten: (ev, world) => [{ sound: "page", at: posOf(world, ev.player) }],
};

interface Fighter { grounded: boolean; airTime: number; down: boolean; strideM: number; last: Vec2 }

interface Flying { kind: SkillObjectKind; impact: SoundName; rate: number; at: Vec2 }

// Each keyed by the step it began, so a resync that takes it back and replays it isn't heard twice.
function hearFighters(fight: Fight, fighters: Map<Entity, Fighter>, begun: Map<string, number>, cues: Cue[]): void {
  const { world, steps } = fight, step = STEP_SOUNDS[fight.arena.look];
  const since = (seconds: number) => steps - Math.round(seconds / FIXED_DT);
  for (const [e, body] of world.query(Body)) {
    const player = world.get(e, Player), enemy = world.get(e, Enemy);
    if (!player && !enemy) continue;
    const at = flat(body.pos), wielder = world.get(e, Wielder), swing = wielder?.swing ?? null;
    const item = wielder && weaponItemIn(wielder.hands), massKg = item ? ITEMS[item].weight : ITEMS.sword.weight;
    const cue = (sound: SoundName, more: Partial<Cue> = {}) => cues.push({ sound, at, ...more });
    const once = (what: string, beganAt: number, sound: SoundName, more?: Partial<Cue>) => {
      const key = `${e} ${what} ${beganAt}`;
      if (beganAt < steps - MAX_LATE_STEPS || begun.has(key)) return;
      begun.set(key, beganAt);
      cue(sound, more);
    };

    if (swing && swing.step >= swing.driveAt) {
      once("swing", steps - swing.step + swing.driveAt, "swing", swingVoice(massKg, swing.attack));
    }
    if (player && swing?.attack === "heavy" && swing.step < swing.liveAt) {
      once("heavy", steps - swing.step, "draw-blade", swingVoice(massKg, "heavy"));
    }
    if (enemy) {
      const { windup, death } = ENEMY_SOUNDS[enemy.def.id];
      if (windup && WINDUPS.includes(enemy.state)) {
        const next = enemy.state === "weaponWindup" ? swing?.attack ?? "light" : "light";
        once(enemy.state, since(enemy.stateTime), windup, swingVoice(massKg, next));
      }
      if (enemy.state === "dead") once("dead", since(enemy.stateTime), death);
    }
    const casting = world.get(e, Skilled);
    if (casting?.casting) once("cast", since(casting.castTime), "windup-magic");
    if (player?.action === "dodge") once("dodge", since(player.actionTime), "dodge");
    if (player && !player.grounded && body.vel.y > 0) once("jump", since(player.airTime), "jump");

    const now = {
      grounded: player?.grounded ?? true, airTime: player?.airTime ?? 0,
      down: enemy ? enemy.state === "dead" : (world.get(e, Health)?.hp ?? 1) <= 0,
    };
    const was = fighters.get(e) ?? { ...now, strideM: 0, last: at };
    if (player && now.down && !was.down) cue("fall");
    if (now.grounded && !was.grounded && was.airTime > LAND_AFTER_AIR_TIME) cue("land");
    const movedM = Math.hypot(at.x - was.last.x, at.z - was.last.z);
    if (movedM < JUMPED_M && now.grounded && !now.down && player?.action !== "dodge") was.strideM += movedM;
    if (was.strideM >= STRIDE_M) {
      was.strideM -= STRIDE_M;
      cue(step, { gain: enemy ? ENEMY_STEP_GAIN : 1 });
    }
    fighters.set(e, { ...was, ...now, last: at });
  }
  for (const [key, beganAt] of begun) if (beganAt < steps - FORGET_STEPS) begun.delete(key);
}

// A reload remakes every skill object as a new entity: the ones it took away didn't land.
function hearSkills(
  world: World, flying: Map<Entity, Flying>, reloaded: boolean, cues: Cue[], loops: Map<string, Cue>,
): void {
  const sums = new Map<string, { sound: SoundName; rate: number; gain: number; x: number; z: number; n: number }>();
  for (const [e, o] of world.query(SkillObject)) {
    const el = elementOf(o), at = flat(o.pos);
    flying.set(e, { kind: o.kind, impact: el.impact, rate: el.rate, at });
    if (o.kind !== "bolt" && o.kind !== "beam" && o.kind !== "cloud") continue;
    // Split Bolts fly together: one loop for a caster's kind and element, from their middle.
    const key = `${o.caster} ${o.kind} ${el.loop}`;
    const gain = o.kind === "cloud" ? CLOUD_GAIN : 1;
    const sum = sums.get(key) ?? { sound: el.loop, rate: el.rate, gain, x: 0, z: 0, n: 0 };
    sums.set(key, { ...sum, x: sum.x + at.x, z: sum.z + at.z, n: sum.n + 1 });
  }
  for (const [e, f] of flying) {
    if (world.has(e, SkillObject)) continue;
    if (f.kind === "bolt" && !reloaded) cues.push({ sound: f.impact, at: f.at, rate: f.rate });
    flying.delete(e);
  }
  for (const [key, s] of sums) {
    loops.set(key, { sound: s.sound, at: { x: s.x / s.n, z: s.z / s.n }, rate: s.rate, gain: s.gain });
  }
}

export function fightEars(): (ctx: FightToHear) => Heard | null {
  let heard: Fight | null = null, fired = new FiredEffects(), outcome = "fighting";
  let fighters = new Map<Entity, Fighter>(), begun = new Map<string, number>(), flying = new Map<Entity, Flying>();
  let restores = 0;
  return (ctx) => {
    const fight = ctx.fight;
    if (!fight) return null;
    if (fight !== heard) {
      [heard, fired, outcome, restores] = [fight, new FiredEffects(), ctx.outcome.state, ctx.sync?.stats.restores ?? 0];
      [fighters, begun, flying] = [new Map(), new Map(), new Map()];
    }
    const { world, arena } = fight, cues: Cue[] = [], loops = new Map<string, Cue>();
    for (const { event } of fired.take(ctx.events)) {
      cues.push(...(EVENT_CUES[event.type] as ((ev: FightEvent, w: World) => Cue[]) | undefined)?.(event, world) ?? []);
    }
    hearFighters(fight, fighters, begun, cues);
    const reloaded = (ctx.sync?.stats.restores ?? 0) !== restores;
    restores = ctx.sync?.stats.restores ?? 0;
    hearSkills(world, flying, reloaded, cues, loops);
    if (ctx.outcome.state !== outcome) {
      outcome = ctx.outcome.state;
      if (outcome !== "fighting") cues.push({ sound: outcome === "won" ? "victory" : "defeat", at: null });
    }
    const ambience = ARENA_AMBIENCE[arena.look];
    if (ambience) loops.set("ambience", { sound: ambience, at: null });
    return { ears: { x: ctx.view.at.x, z: ctx.view.at.z, yaw: ctx.view.yaw }, hearing: ARENA_HEARING, cues, loops };
  };
}
