/** Who's in a fight and where they start, and building them: components plus a collider each. */
import type { Entity, World } from "../../core/ecs.js";
import type { Vec3 } from "../../core/math.js";
import type { Burden } from "../../items/burden.js";
import {
  Body, ChargeAttack, Enemy, Fighter, Health, LungeAttack, Player, Stamina, SwordAttack,
} from "../components.js";
import type { ArenaDef, EnemyAttacks, EnemyDef } from "../defs.js";
import { copyInput, IDLE_INPUT, PlayerInput } from "../input.js";
import { PLAYER, type Vitals } from "../player.js";
import { FighterStats, type Stats } from "../stats.js";
import { Layer, type ArenaPhysics } from "./physics/arena-physics.js";

/** A one-on-one's starting spots (feet, a little above the floor; the arena's center is 0), the enemy facing you. */
export const PLAYER_START: Vec3 = { x: 0, y: 0.05, z: -8 };
export const ENEMY_START: Vec3 = { x: 0, y: 0.05, z: 6 };
export const ENEMY_START_YAW = Math.PI;

/** `vitals`, `stats` and `burden` (how weighed down the bag leaves them): what they come in with. */
export interface PlayerSetup { at: Vec3; vitals: Vitals; stats: Stats; burden: Burden }
/** `at`: the feet. `yaw`: which way it faces. `seed`: its random numbers' (the server picks it; 1 if left out). */
export interface EnemySetup { def: EnemyDef; at: Vec3; yaw: number; seed?: number }
export interface FightSetup { arena: ArenaDef; players: PlayerSetup[]; enemies: EnemySetup[] }

/** From the feet to the capsule's center, and from there to each cap's middle. */
const PLAYER_CENTER_HEIGHT = PLAYER.height / 2;
const PLAYER_HALF_SEGMENT = PLAYER.height / 2 - PLAYER.radius;

const centerAbove = (feet: Vec3, height: number): Vec3 => ({ x: feet.x, y: feet.y + height, z: feet.z });

export function spawnPlayer(world: World, physics: ArenaPhysics, setup: PlayerSetup): Entity {
  const e = world.spawn();
  const center = centerAbove(setup.at, PLAYER_CENTER_HEIGHT);
  const collider = physics.addCapsule(center, PLAYER_HALF_SEGMENT, PLAYER.radius, Layer.Player);
  const pos = physics.position(collider);
  world.add(e, Body, { pos, vel: { x: 0, y: 0, z: 0 }, centerHeight: PLAYER_CENTER_HEIGHT, collider });
  world.add(e, PlayerInput, copyInput(IDLE_INPUT));
  world.add(e, Player, {
    grounded: false, airTime: 0, jumpBuffer: 0, jumpHeld: false,
    attackHeld: null, dodgeHeld: false, attackBuffer: 0, dodgeBuffer: 0, queued: null,
    action: "none", actionTime: 0, actionDir: { x: 0, z: 1 },
    attack: "lr", startup: 0, power: 1, combo: null, comboTime: 0, momentum: 0, burden: setup.burden,
  });
  world.add(e, Health, { hp: setup.vitals.hp, max: PLAYER.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Stamina, { value: setup.vitals.stamina, max: setup.stats.stamina, regenDelay: 0 });
  world.add(e, FighterStats, { ...setup.stats });
  world.add(e, Fighter, { team: "player", radius: PLAYER.radius });
  return e;
}

/** How to add each kind of attack to an entity: one component per attack, each with its own system (enemies/). */
type AddAttack<K extends keyof EnemyAttacks> =
  (world: World, e: Entity, def: NonNullable<EnemyAttacks[K]>, seed: number) => void;
const ATTACKS: { [K in keyof EnemyAttacks]-?: AddAttack<K> } = {
  lunge: (world, e, def) => { world.add(e, LungeAttack, { def, cooldown: def.firstDelay }); },
  charge: (world, e, def) => { world.add(e, ChargeAttack, { def, cooldown: def.firstDelay, dir: { x: 0, z: 1 } }); },
  sword: (world, e, def, seed) => {
    world.add(e, SwordAttack, {
      def, cooldown: def.firstDelay, attack: def.moves[0] ?? "lr", swingsLeft: 0, rng: seed >>> 0, parryCooldown: 0,
    });
  },
};

/** An arena enemy built from its def (sent by the server with the encounter): body, brain, one part per attack. */
export function spawnEnemy(world: World, physics: ArenaPhysics, { def, at, yaw, seed = 1 }: EnemySetup): Entity {
  const e = world.spawn();
  const collider = physics.addBall(centerAbove(at, def.radius), def.radius, Layer.Enemy);
  const pos = physics.position(collider);
  world.add(e, Body, { pos, vel: { x: 0, y: 0, z: 0 }, centerHeight: def.radius, collider });
  world.add(e, Enemy, {
    def, state: "approach", stateTime: 0, duration: 0, yaw, poise: def.poise, armored: false,
    sense: { dist: Infinity, toYaw: yaw, facingDot: 1, targetAlive: false },
    move: { dirX: 0, dirZ: 0, speed: 0, accel: 0, halt: false },
  });
  for (const [kind, attack] of Object.entries(def.attacks) as [keyof EnemyAttacks, never][]) {
    if (attack) ATTACKS[kind](world, e, attack, seed);
  }
  world.add(e, Health, { hp: def.maxHp, max: def.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Fighter, { team: "enemy", radius: def.radius });
  world.add(e, FighterStats, { ...def.stats });
  return e;
}
