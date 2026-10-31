/** Fights for tests: enemies whose numbers the tests own (like TEST_LEVEL), inputs, and a dump of the state. */
import {
  ActiveHit, ATTACK_KINDS, BASE_STATS, blankSkillbook, Body, GUARD_SIDES, releaseTime, ChargeAttack, emptyBag, Enemy,
  Health, LungeAttack, maxHpOf, newCore, PERILOUS, Player, PLAYER, PlayerInput, Posture, Sidestep, SkillAttack, Skilled,
  SkillObject,
  Stamina, staminaMaxOf, starterEquipment, Statuses, STRIKES, SWING_DIRS, WeaponAttack, Wielder,
  type ArenaDef, type EnemyDef, type Entity, type LungeDef, type PlayerInputData, type Segment, type Skill, type Stats,
  type SkillAttackDef, type Vec3, type WeaponAttackDef,
} from "@infinite-tower/shared";
import { Fight, type EnemySetup, type PlayerSetup } from "@infinite-tower/shared/fight";

export const ARENA: ArenaDef = { id: "test", radius: 8, look: "forest-clearing" };
/** No HP regen, so HP changes only by what a test does (core-stats.test.ts has the regen). */
export const STATS: Stats = { ...BASE_STATS, healthRegen: 0 };
export const FULL_HP = maxHpOf(STATS);
export const FULL_STAMINA = staminaMaxOf(STATS);

const ENEMY_BASE: EnemyDef = {
  id: "wild-boar", name: "Test", maxHp: 100,
  stats: { ...STATS, skillpower: 0 },
  radius: 0.85, walkSpeed: 0, turnRate: 0, poise: 1000, poiseRegen: 0, staggerTime: 1, posture: 100, attacks: {},
};

/** Stands where it's put and never attacks. */
export const STATUE: EnemyDef = ENEMY_BASE;

/** Stands where it's put, and steps aside from every Bolt aimed at it. */
export const STEPPER: EnemyDef = {
  ...ENEMY_BASE, sidestep: { chance: 1, reactTime: 0.2, leadTime: 0.1, speed: 6, stepTime: 0.45 },
};

const lunge = (over: Partial<LungeDef>): LungeDef => ({
  triggerDist: 2.8, range: 2.6, minDot: 0.35, windup: 0.3, active: 0.18, recover: 0.5, speed: 6,
  damage: 10, knockback: 8, lift: 3, cooldown: 99, firstDelay: 0, ...over,
});

/** Rushes forward for a second when someone is close in front; its hit never reaches anyone, only its body does. */
export const RAM: EnemyDef = {
  ...ENEMY_BASE, turnRate: 3,
  attacks: { lunge: lunge({ triggerDist: 3, range: -1, minDot: 1, windup: 0.1, active: 1, speed: 4, damage: 0 }) },
};

/** Stands still and bites what comes close in front: damage, knockback and lift. */
export const BITER: EnemyDef = { ...ENEMY_BASE, turnRate: 3, attacks: { lunge: lunge({}) } };

/** Like the wild boar: walks up, lunges up close, charges from afar. */
export const BOAR: EnemyDef = {
  ...ENEMY_BASE, maxHp: 60, walkSpeed: 3.2, turnRate: 3, poise: 36, poiseRegen: 8,
  attacks: {
    lunge: lunge({ triggerDist: 2.8, windup: 0.65, recover: 0.75, damage: 16, cooldown: 0.6 }),
    charge: {
      minDist: 5, maxDist: 22, range: 1.9, minDot: 0.2, windup: 1.1, lockAt: 0.3, speed: 17, maxChargeTime: 1.6,
      recover: 0.9, stunTime: 2.2, damage: 30, knockback: 15, lift: 6, cooldown: 4.5, firstDelay: 2,
    },
  },
};

export const swings = (over: Partial<WeaponAttackDef>): WeaponAttackDef => ({
  triggerDist: 3, windup: 0.3, chainWindup: 0.3, speed: 0, recover: 0.8, minChain: 1, maxChain: 1, heavyShare: 0,
  cooldown: 99, firstDelay: 0,
  hybrid: {
    windupTime: 0.6, chainWindupTime: 0.4, recoverTime: 0.8, blockReactTime: 0, tapParryChance: 0, kickAfterTime: 99,
    kickChance: 0,
  },
  posture: {
    windupTime: 0.6, chainWindupTime: 0.4, delayTime: 0.3, delayChance: 0, minString: 1, maxString: 1,
    perilousChance: 0, ends: { thrust: 1, sweep: 0, grab: 0 }, recoverTime: 0.8, deflectChance: 0,
    thrustDeflectChance: 0, sweepStepBackChance: 0, backOffShare: 2, backOffM: 2,
  },
  ...over,
});

export const SWORDSMAN: EnemyDef = {
  ...ENEMY_BASE, id: "kobold-swordsman", radius: 0.5, turnRate: 3,
  wielder: { hands: { rightHand: "sword" }, armReachM: PLAYER.armReachM },
  attacks: { weapon: swings({}) },
};

export const GUARDIAN: EnemyDef = { ...SWORDSMAN, attacks: { weapon: swings({ firstDelay: 999 }) } };

export const casts = (over: Partial<SkillAttackDef>): SkillAttackDef => ({
  skill: { form: "bolt", elements: ["fire"], modifiers: [] }, extras: [], quickCastM: 5, rangeM: 14, wordTime: 0.4,
  cooldown: 1, firstDelay: 0, ...over,
});

export const CASTER: EnemyDef = {
  ...ENEMY_BASE, id: "goblin-warlock", radius: 0.45, walkSpeed: 2.4, turnRate: 4, stats: { ...STATS },
  keepAway: { nearM: 4, farM: 7 }, attacks: { skill: casts({}) },
};

export const player = (at: Vec3, over: Partial<PlayerSetup> = {}): PlayerSetup =>
  ({ at, vitals: { hp: FULL_HP, stamina: FULL_STAMINA }, stats: STATS, core: newCore(), burden: "light",
    gear: { bag: emptyBag(), equipment: starterEquipment() }, book: blankSkillbook(), ...over });
export const enemy = (def: EnemyDef, at: Vec3, yaw = Math.PI): EnemySetup => ({ def, at, yaw });

/** One player against one enemy, both standing on the ground. */
export function duel(def: EnemyDef, playerAt: Vec3, enemyAt: Vec3, enemyYaw = Math.PI): Fight {
  return new Fight({ arena: ARENA, players: [player(playerAt)], enemies: [enemy(def, enemyAt, enemyYaw)] });
}

export const IDLE: PlayerInputData = {
  moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: null, dodge: false, guard: null, guardBreak: false,
  way: null, block: false, kick: false, perilous: null, cast: null, castHeld: false, chant: false, chantWords: null,
  write: null, locked: null, bag: false, gear: null, use: null,
};
export const input = (over: Partial<PlayerInputData>): PlayerInputData => ({ ...IDLE, ...over });

export function busyHybrid(step: number): PlayerInputData {
  return input({
    ...busy(step), guard: null, way: SWING_DIRS[Math.floor(step / 13) % SWING_DIRS.length]!,
    attack: step % 9 < 2 ? STRIKES[Math.floor(step / 9) % STRIKES.length]! : null,
    block: step % 71 > 50, kick: step % 59 === 3,
  });
}

export function busyPosture(step: number): PlayerInputData {
  return input({
    ...busy(step), guard: null, attack: step % 9 < 2 ? "light" : null, block: step % 37 > 25,
    perilous: step % 61 < 2 ? PERILOUS[Math.floor(step / 61) % PERILOUS.length]! : null,
  });
}

/** Steps `seconds` of fight, the one player giving `next(step)` each step. */
export function run(fight: Fight, seconds: number, next: (step: number) => PlayerInputData = () => IDLE): void {
  const steps = Math.round(seconds / Fight.STEP_SECONDS);
  for (let i = 0; i < steps; i++) fight.step([next(i)]);
}

export const segment = (
  form: Segment["form"], elements: Segment["elements"] = [], modifiers: Segment["modifiers"] = [],
): Segment => ({ form, elements, modifiers });
export const skill = (...segments: [Segment, ...Segment[]]): Skill => ({ segments });

export function castNow(fight: Fight, cast: Skill, over: Partial<PlayerInputData> = {}): void {
  fight.step([input({ ...over, chant: true })]);
  fight.step([input({ ...over, cast })]);
  run(fight, releaseTime(cast) - Fight.STEP_SECONDS, () => input({ ...over, cast: null }));
}

export const bodyOf = (fight: Fight, e: Entity) => fight.world.require(e, Body);
export const flatDist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);
export const flatRadius = (p: Vec3): number => Math.hypot(p.x, p.z);

/** Every number in the fight's state, in a fixed order: two fights in the same state give the same string. */
export function dumpState(fight: Fight): string {
  const rows = [...fight.players, ...fight.enemies].map((e) => {
    const enemyData = fight.world.get(e, Enemy);
    const hit = fight.world.get(e, ActiveHit);
    return {
      e,
      body: fight.world.get(e, Body),
      health: fight.world.get(e, Health),
      stamina: fight.world.get(e, Stamina),
      player: fight.world.get(e, Player),
      input: fight.world.get(e, PlayerInput),
      // `sense` and `move` are worked out afresh each step before they're read: not part of the state.
      enemy: enemyData && { ...enemyData, def: enemyData.def.id, sense: undefined, move: undefined },
      lunge: fight.world.get(e, LungeAttack)?.cooldown,
      charge: fight.world.get(e, ChargeAttack) && { ...fight.world.get(e, ChargeAttack), def: undefined },
      weapon: fight.world.get(e, WeaponAttack) && { ...fight.world.get(e, WeaponAttack), def: undefined },
      wielder: fight.world.get(e, Wielder),
      sidestep: fight.world.get(e, Sidestep) && { ...fight.world.get(e, Sidestep), def: undefined },
      skill: fight.world.get(e, SkillAttack) && { ...fight.world.get(e, SkillAttack), def: undefined },
      skilled: fight.world.get(e, Skilled),
      hit: hit && { ...hit, alreadyHit: [...hit.alreadyHit] },
      statuses: fight.world.get(e, Statuses),
      posture: fight.world.get(e, Posture),
    };
  });
  const shots = [...fight.world.query(SkillObject)].map(([, shot]) => shot);
  return JSON.stringify({ steps: fight.steps, outcome: fight.outcome, rows, shots });
}

/**
 * A busy player that only looks at the step number, so two fights get the same inputs whatever happens in them:
 * turning, running in every direction (into the wall too: the arena is small), every attack in turn from every side,
 * locking on and off, dodging and jumping.
 */
export function busy(step: number): PlayerInputData {
  const turn = step * 0.05, run = Math.floor(step / 40) * 1.3;
  return input({
    aimX: Math.round(Math.sin(turn) * 1000) / 1000, aimZ: Math.round(Math.cos(turn) * 1000) / 1000,
    moveX: Math.round(Math.sin(run) * 1000) / 1000, moveZ: Math.round(Math.cos(run) * 1000) / 1000,
    attack: step % 9 < 2 ? ATTACK_KINDS[Math.floor(step / 9) % ATTACK_KINDS.length]! : null,
    dodge: step % 47 === 0, jump: step % 83 < 10,
    locked: step % 101 > 30 ? 0 : null, guard: GUARD_SIDES[Math.floor(step / 23) % GUARD_SIDES.length]!,
  });
}
