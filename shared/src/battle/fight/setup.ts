/** Who's in a fight, where they start, and building them: components plus a collider each. */
import type { Entity, World } from "../../core/ecs.js";
import type { Vec3 } from "../../core/math.js";
import type { Character } from "../../character/character.js";
import type { Burden } from "../../items/burden.js";
import type { Carried } from "../../items/gear.js";
import type { Skillbook } from "../../skills/skill.js";
import type { CoreState } from "../../soul/core.js";
import { ENEMY_GUARD } from "../../weapons/weapons.js";
import type { ArenaDef } from "../../world/arena.js";
import {
  Body, ChargeAttack, Enemy, Fighter, Health, LungeAttack, Player, Sidestep, SkillAttack, Skilled, Stamina, Statuses,
  WeaponAttack, Wielder, type HealthData, type WielderData,
} from "../components.js";
import type { EnemyAttacks, EnemyDef } from "../defs.js";
import { copyInput, IDLE_INPUT, PlayerInput } from "../input.js";
import { PLAYER, type Vitals } from "../player.js";
import { FighterStats, maxHpOf, staminaMaxOf, type Stats } from "../stats.js";
import { Layer, type ArenaPhysics } from "./physics/arena-physics.js";
import { newSkilled } from "./skills/skilled.js";
import { noStatuses } from "./skills/statuses.js";
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
  seed?: number; invulnerable?: boolean; who?: { name: string; character: Character };
}
/** `at`: the feet. `seed`: its random numbers' (the server picks it). */
export interface EnemySetup { def: EnemyDef; at: Vec3; yaw: number; seed?: number }
export interface FightSetup { arena: ArenaDef; players: PlayerSetup[]; enemies: EnemySetup[]; duel?: boolean }

/** From the feet to the capsule's center, and from there to each cap's middle. */
const PLAYER_CENTER_HEIGHT = PLAYER.height / 2;
const PLAYER_HALF_SEGMENT = PLAYER.height / 2 - PLAYER.radius;

const centerAbove = (feet: Vec3, height: number): Vec3 => ({ x: feet.x, y: feet.y + height, z: feet.z });

const fresh = (maxHp: number): HealthData =>
  ({ hp: maxHp, max: maxHp, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0 });

const wielder = (hands: WielderData["hands"], armReachM: number): WielderData =>
  ({ hands, armReachM, swing: null, grab: null, grabImmuneTime: 0 });

export function spawnPlayer(world: World, physics: ArenaPhysics, setup: PlayerSetup, side = 0): Entity {
  const e = world.spawn();
  const center = centerAbove(setup.at, PLAYER_CENTER_HEIGHT);
  const collider = physics.addCapsule(center, PLAYER_HALF_SEGMENT, PLAYER.radius, Layer.Player);
  const pos = physics.position(collider);
  world.add(e, Body, { pos, vel: { x: 0, y: 0, z: 0 }, centerHeight: PLAYER_CENTER_HEIGHT, collider });
  world.add(e, PlayerInput, copyInput(IDLE_INPUT));
  world.add(e, Player, {
    grounded: false, airTime: 0, jumpBuffer: 0, jumpHeld: false,
    attackHeld: null, dodgeHeld: false, guardBreakHeld: false, attackBuffer: 0, dodgeBuffer: 0, guardBreakBuffer: 0,
    castBuffer: 0, queued: null,
    castQueued: null, writeHeld: false, gearHeld: false, useHeld: false, wordsHeld: false, brokenOff: false,
    writing: null, using: null,
    book: setup.book,
    action: "none", actionTime: 0, actionDir: { x: 0, z: 1 }, guard: null, burden: setup.burden, gear: setup.gear,
    core: setup.core, invulnerable: setup.invulnerable ?? false, leftArena: false,
  });
  world.add(e, Skilled, newSkilled({ x: 0, z: 1 }, setup.seed ?? 1));
  world.add(e, Wielder, wielder(handsOf(setup.gear.equipment), PLAYER.armReachM));
  world.add(e, Health, { ...fresh(maxHpOf(setup.stats)), hp: setup.vitals.hp });
  world.add(e, Stamina, { value: setup.vitals.stamina, max: staminaMaxOf(setup.stats), regenDelay: 0 });
  world.add(e, FighterStats, { ...setup.stats });
  world.add(e, Fighter, { team: "player", side, radius: PLAYER.radius });
  world.add(e, Statuses, noStatuses());
  return e;
}

type AddAttack<K extends keyof EnemyAttacks> = (world: World, e: Entity, def: NonNullable<EnemyAttacks[K]>) => void;
const ATTACKS: { [K in keyof EnemyAttacks]-?: AddAttack<K> } = {
  lunge: (world, e, def) => { world.add(e, LungeAttack, { def, cooldown: def.firstDelay }); },
  charge: (world, e, def) => { world.add(e, ChargeAttack, { def, cooldown: def.firstDelay, dir: { x: 0, z: 1 } }); },
  weapon: (world, e, def) => {
    world.add(e, WeaponAttack, {
      def, cooldown: def.firstDelay, swingsLeft: 0, chain: 0, next: "light",
      guard: "top", guardFrom: "top", guardMoveTime: 0, guardHoldTime: ENEMY_GUARD.minHoldTime, parryRead: false,
      feint: false, riposte: false,
    });
  },
  skill: (world, e, def) => { world.add(e, SkillAttack, { def, cooldown: def.firstDelay, toSay: [] }); },
};

export function spawnEnemy(world: World, physics: ArenaPhysics, { def, at, yaw, seed = 1 }: EnemySetup): Entity {
  const e = world.spawn();
  const collider = physics.addBall(centerAbove(at, def.radius), def.radius, Layer.Enemy);
  const pos = physics.position(collider);
  world.add(e, Body, { pos, vel: { x: 0, y: 0, z: 0 }, centerHeight: def.radius, collider });
  world.add(e, Enemy, {
    def, state: "approach", stateTime: 0, duration: 0, yaw, poise: def.poise, armored: false,
    sense: { dist: Infinity, toYaw: yaw, facingDot: 1, targetAlive: false, target: null },
    move: { dirX: 0, dirZ: 0, speed: 0, accel: 0, halt: false }, rng: seed >>> 0,
  });
  for (const [kind, attack] of Object.entries(def.attacks) as [keyof EnemyAttacks, never][]) {
    if (attack) ATTACKS[kind](world, e, attack);
  }
  if (def.sidestep) world.add(e, Sidestep, { def: def.sidestep, dir: { x: 0, z: 0 } });
  if (def.wielder) {
    world.add(e, Wielder, wielder({ rightHand: null, leftHand: null, ...def.wielder.hands }, def.wielder.armReachM));
  }
  world.add(e, Health, fresh(def.maxHp));
  world.add(e, Fighter, { team: "enemy", side: -1, radius: def.radius });
  world.add(e, FighterStats, { ...def.stats });
  const stamina = staminaMaxOf(def.stats);
  if (def.attacks.skill) world.add(e, Stamina, { value: stamina, max: stamina, regenDelay: 0 });
  world.add(e, Statuses, noStatuses());
  world.add(e, Skilled, newSkilled({ x: Math.sin(yaw), z: Math.cos(yaw) }, seed));
  return e;
}
