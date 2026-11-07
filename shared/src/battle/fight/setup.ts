/** Who's in a fight, where they start, and building them: components plus a collider each. */
import type { ComponentType, Entity, System, World } from "../../core/ecs.js";
import type { Vec3 } from "../../core/math.js";
import type { Character } from "../../character/character.js";
import type { Burden } from "../../items/burden.js";
import type { Carried } from "../../items/gear.js";
import type { Skillbook } from "../../skills/skill.js";
import type { CoreState } from "../../soul/core.js";
import type { BlessingGod } from "../../soul/blessings.js";
import { HYBRID } from "../../weapons/hybrid.js";
import type { ArenaDef } from "../../world/arena.js";
import {
  Body, ChargeAttack, Enemy, Fighter, Health, LungeAttack, Player, PounceAttack, Sidestep, SkillAttack, Skilled,
  SlamAttack, Stamina, Statuses, WeaponAttack, Wielder, type EnemyData, type HealthData, type WeaponAttackData,
  type WielderData,
} from "../components.js";
import type {
  ChargeDef, EnemyAttacks, EnemyDef, LungeDef, PounceDef, SkillAttackDef, SlamDef, WeaponAttackDef,
} from "../defs.js";
import { copyInput, IDLE_INPUT, PlayerInput } from "../input.js";
import { PLAYER, type Vitals } from "../player.js";
import { FighterStats, maxHpOf, staminaMaxOf, type Stats } from "../stats.js";
import { passivesOf } from "../statuses.js";
import { chargeAttackSystem } from "./behaviors/charge.js";
import { lungeAttackSystem } from "./behaviors/lunge.js";
import { circleAgain, pounceAttackSystem } from "./behaviors/pounce.js";
import { skillAttackSystem } from "./behaviors/skill.js";
import { slamAttackSystem } from "./behaviors/slam.js";
import { weaponAttackSystem } from "./behaviors/weapon.js";
import type { FightContext } from "./context.js";
import { Layer, type ArenaPhysics } from "./physics/arena-physics.js";
import { newSkilled } from "./skills/skilled.js";
import { noStatuses } from "./statuses.js";
import { handsOf } from "./weapons/swing.js";

/** A one-on-one's starting spots (feet, a little above the floor; the arena's center is 0), the enemy facing you. */
export const PLAYER_START: Vec3 = { x: 0, y: 0.05, z: -8 };
export const ENEMY_START: Vec3 = { x: 0, y: 0.05, z: 6 };
export const ENEMY_START_YAW = Math.PI;
export const DUEL_STARTS: readonly Vec3[] = [{ x: 0, y: 0.05, z: -6 }, { x: 0, y: 0.05, z: 6 }];
const JOIN_WALL_GAP_M = 2;
/** Off the arena's -z: the players' side. */
const JOIN_ANGLES_RAD = [0.7, -0.7, 0];

/** `seat` counts from 1. */
export function joinStart(arena: ArenaDef, seat: number): Vec3 {
  const angle = JOIN_ANGLES_RAD[(seat - 1) % JOIN_ANGLES_RAD.length]!, r = arena.radius - JOIN_WALL_GAP_M;
  return { x: Math.sin(angle) * r, y: 0.05, z: -Math.cos(angle) * r };
}

export interface PlayerSetup {
  at: Vec3; vitals: Vitals; stats: Stats; core: CoreState; burden: Burden; gear: Carried; book: Skillbook;
  seed?: number; invulnerable?: boolean; who?: { name: string; character: Character }; blessings?: BlessingGod[];
}
/** `at`: the feet. `seed`: its random numbers' (the server picks it). */
export interface EnemySetup { def: EnemyDef; at: Vec3; yaw: number; seed?: number }
export interface FightSetup {
  arena: ArenaDef; players: PlayerSetup[]; enemies: EnemySetup[]; duel?: boolean; yieldAt?: number;
}

/** From the feet to the capsule's center, and from there to each cap's middle. */
const PLAYER_CENTER_HEIGHT = PLAYER.height / 2;
const PLAYER_HALF_SEGMENT = PLAYER.height / 2 - PLAYER.radius;

const centerAbove = (feet: Vec3, height: number): Vec3 => ({ x: feet.x, y: feet.y + height, z: feet.z });

const fresh = (maxHp: number): HealthData =>
  ({ hp: maxHp, max: maxHp, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });

const wielder = (hands: WielderData["hands"], armReachM: number): WielderData => ({
  hands, armReachM, swing: null, combo: null, comboTime: 0, momentum: 0, feintRecoverSteps: 0,
});

export function spawnPlayer(world: World, physics: ArenaPhysics, setup: PlayerSetup, side = 0): Entity {
  const e = world.spawn();
  const center = centerAbove(setup.at, PLAYER_CENTER_HEIGHT);
  const collider = physics.addCapsule(center, PLAYER_HALF_SEGMENT, PLAYER.radius, Layer.Player);
  const pos = physics.position(collider);
  world.add(e, Body, { pos, vel: { x: 0, y: 0, z: 0 }, centerHeight: PLAYER_CENTER_HEIGHT, collider });
  world.add(e, PlayerInput, copyInput(IDLE_INPUT));
  world.add(e, Player, {
    grounded: false, airTime: 0, jumpBuffer: 0, last: copyInput(IDLE_INPUT), attackBuffer: 0, dodgeBuffer: 0,
    castBuffer: 0, dodgeCooldownSteps: 0, perfectBlockLeft: 0, sinceBlockPress: HYBRID.block.remashTime,
    handSwitchQueued: false, queued: null,
    castQueued: null, brokenOff: false,
    writing: null, using: null,
    book: setup.book,
    action: "none", actionTime: 0, actionDir: { x: 0, z: 1 }, way: null, burden: setup.burden,
    gear: setup.gear,
    core: setup.core, invulnerable: setup.invulnerable ?? false, leftArena: false,
  });
  world.add(e, Skilled, newSkilled({ x: 0, z: 1 }, setup.seed ?? 1));
  world.add(e, Wielder, wielder(handsOf(setup.gear.equipment), PLAYER.armReachM));
  world.add(e, Health, { ...fresh(maxHpOf(setup.stats)), hp: setup.vitals.hp });
  world.add(e, Stamina, { value: setup.vitals.stamina, max: staminaMaxOf(setup.stats), regenDelay: 0 });
  world.add(e, FighterStats, { ...setup.stats });
  world.add(e, Fighter, { team: "player", side, radius: PLAYER.radius, heightM: PLAYER.height });
  world.add(e, Statuses, { ...noStatuses(), on: passivesOf(setup.core.inscriptions, setup.blessings ?? []) });
  return e;
}

interface AttackRow<D, T extends { def: D }> {
  component: ComponentType<T>;
  start: (def: D, enemy: EnemyData) => NoInfer<T>;
  system: (ctx: FightContext) => System;
}
const row = <D, T extends { def: D }>(r: AttackRow<D, T>) => r;

export type AttackKind = keyof EnemyAttacks;
/** The fight's state saves each component but its `def`, so the rest must be plain data. Systems run in this order. */
export const ATTACKS = {
  charge: row({
    component: ChargeAttack, system: chargeAttackSystem,
    start: (def: ChargeDef) => ({ def, cooldown: def.firstDelay, dir: { x: 0, z: 1 } }),
  }),
  lunge: row({
    component: LungeAttack, system: lungeAttackSystem, start: (def: LungeDef) => ({ def, cooldown: def.firstDelay }),
  }),
  pounce: row({
    component: PounceAttack, system: pounceAttackSystem,
    start: (def: PounceDef, enemy) => {
      const pounce = { def, cooldown: 0, side: 1, dir: { x: 0, z: 1 } };
      circleAgain(pounce, enemy, def.firstDelay);
      return pounce;
    },
  }),
  slam: row({
    component: SlamAttack, system: slamAttackSystem, start: (def: SlamDef) => ({ def, cooldown: def.firstDelay }),
  }),
  weapon: row({
    component: WeaponAttack, system: (ctx) => weaponAttackSystem(ctx.events),
    start: (def: WeaponAttackDef): WeaponAttackData => ({
      def, cooldown: def.firstDelay, swingsLeft: 0, perfectBlockRead: false, riposte: false, feint: false, way: "tb",
    }),
  }),
  skill: row({
    component: SkillAttack, system: skillAttackSystem,
    start: (def: SkillAttackDef) => ({ def, cooldown: def.firstDelay, toSay: [] }),
  }),
} satisfies { [K in AttackKind]-?: AttackRow<NonNullable<EnemyAttacks[K]>, { def: NonNullable<EnemyAttacks[K]> }> };

export function spawnEnemy(world: World, physics: ArenaPhysics, { def, at, yaw, seed = 1 }: EnemySetup): Entity {
  const e = world.spawn();
  const collider = physics.addBall(centerAbove(at, def.radius), def.radius, Layer.Enemy);
  const pos = physics.position(collider);
  world.add(e, Body, { pos, vel: { x: 0, y: 0, z: 0 }, centerHeight: def.radius, collider });
  world.add(e, Enemy, {
    def, state: "approach", stateTime: 0, duration: 0, yaw, poise: def.poise, armored: false,
    sense: { dist: Infinity, toYaw: yaw, facingDot: 1, targetAlive: false, target: null },
    move: { dirX: 0, dirZ: 0, speed: 0, accel: 0, halt: false }, rng: seed >>> 0, struck: [],
  });
  const enemy = world.require(e, Enemy);
  for (const [kind, attack] of Object.entries(def.attacks) as [AttackKind, never][]) {
    const { component, start } = ATTACKS[kind] as AttackRow<unknown, { def: unknown }>;
    if (attack) world.add(e, component, start(attack, enemy));
  }
  if (def.sidestep) world.add(e, Sidestep, { def: def.sidestep, dir: { x: 0, z: 0 } });
  if (def.wielder) {
    const hands = { rightHand: null, leftHand: null, active: "rightHand" as const, ...def.wielder.hands };
    world.add(e, Wielder, wielder(hands, def.wielder.armReachM));
  }
  world.add(e, Health, fresh(def.maxHp));
  world.add(e, Fighter, { team: "enemy", side: -1, radius: def.radius, heightM: def.heightM ?? 2 * def.radius });
  world.add(e, FighterStats, { ...def.stats });
  const stamina = staminaMaxOf(def.stats);
  if (def.attacks.skill) world.add(e, Stamina, { value: stamina, max: stamina, regenDelay: 0 });
  world.add(e, Statuses, noStatuses());
  world.add(e, Skilled, newSkilled({ x: Math.sin(yaw), z: Math.cos(yaw) }, seed));
  return e;
}
