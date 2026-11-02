/**
 * A fight's whole state, out and back in, as exact plain JSON, and its hash. Only what changes during a fight is in
 * it: the setup is the same on both sides, and an enemy's `sense` and `move` are worked out afresh every step.
 */
import type { Entity } from "../../core/ecs.js";
import { roundTo, type Vec2, type Vec3 } from "../../core/math.js";
import {
  ActiveHit, Body, ChargeAttack, Enemy, Health, LungeAttack, Player, PounceAttack, Sidestep, SkillAttack, SkillObject,
  Skilled, SlamAttack, Stamina, Statuses, WeaponAttack, Wielder,
  type ActiveHitData, type EnemyData, type HealthData, type PlayerData, type SkillObjectData, type SkilledData,
  type StaminaData, type StatusData, type SwingData, type WeaponAttackData, type WielderData,
} from "../components.js";
import type { Word } from "../../skills/skill.js";
import { copyInput, PlayerInput, type PlayerInputData } from "../input.js";
import { FighterStats, type Stats } from "../stats.js";
import type { FightOutcome } from "./context.js";
import type { Fight } from "./fight.js";
import { handsOf } from "./weapons/swing.js";

interface FighterSnapshot {
  pos: Vec3;
  vel: Vec3;
  health: HealthData;
  statuses: StatusData;
  wielder: Omit<WielderData, "hands" | "armReachM"> | null;
  skilled: Omit<SkilledData, "target"> & { target: number };
}

interface PlayerSnapshot extends FighterSnapshot {
  player: Omit<PlayerData, "burden">;
  /** The input the player's last step ran with (what they hold). */
  input: PlayerInputData;
  stamina: StaminaData;
  stats: Stats;
}

interface EnemySnapshot extends FighterSnapshot {
  enemy: Omit<EnemyData, "def" | "sense" | "move">;
  lunge: { cooldown: number } | null;
  charge: { cooldown: number; dir: Vec2 } | null;
  pounce: { cooldown: number; side: number; dir: Vec2 } | null;
  slam: { cooldown: number } | null;
  weapon: Omit<WeaponAttackData, "def"> | null;
  sidestep: { dir: Vec2 } | null;
  skill: { cooldown: number; toSay: Word[] } | null;
  stamina: Omit<StaminaData, "max"> | null;
}

/** Whose hitbox it is and whom it has hit, as fighter indices (the players in seat order, then the enemies). */
interface HitSnapshot extends Omit<ActiveHitData, "alreadyHit"> { by: number; alreadyHit: number[] }

// `caster`, `target` and `ignore` as fighter indices (-1: none).
interface ObjectSnapshot extends Omit<SkillObjectData, "caster" | "target" | "ignore"> {
  caster: number;
  target: number;
  ignore: number;
}

export interface FightSnapshot {
  /** Steps run: the fight is as it was after this one. */
  steps: number;
  outcome: FightOutcome;
  players: PlayerSnapshot[];
  enemies: EnemySnapshot[];
  /** In the order the fight checks them. */
  hits: HitSnapshot[];
  skills: ObjectSnapshot[];
}

const copyStatuses = (s: StatusData): StatusData => ({ on: s.on.map((o) => ({ ...o })), cooldown: { ...s.cooldown } });
const copySwing = (s: SwingData | null): SwingData | null => s && { ...s, dir: { ...s.dir } };

const fightersOf = (fight: Fight): Entity[] => [...fight.players, ...fight.enemies];
const indexIn = (fighters: readonly Entity[], e: Entity | null): number => (e === null ? -1 : fighters.indexOf(e));

function saveWielder(wielder: WielderData | undefined): FighterSnapshot["wielder"] {
  if (!wielder) return null;
  const { swing, combo, comboTime, momentum } = wielder;
  return { swing: copySwing(swing), combo, comboTime, momentum };
}

function withoutDef({ def: _, ...state }: WeaponAttackData): Omit<WeaponAttackData, "def"> {
  return state;
}

export function saveFight(fight: Fight): FightSnapshot {
  const { world } = fight;
  const fighters = fightersOf(fight);
  const fighter = (e: Entity): FighterSnapshot => {
    const { pos, vel } = world.require(e, Body);
    const { words, aim, target, ...skilled } = world.require(e, Skilled);
    return {
      pos: { ...pos }, vel: { ...vel }, health: { ...world.require(e, Health) },
      statuses: copyStatuses(world.require(e, Statuses)),
      wielder: saveWielder(world.get(e, Wielder)),
      skilled: { ...skilled, words: [...words], aim: { ...aim }, target: indexIn(fighters, target) },
    };
  };
  return {
    steps: fight.steps,
    outcome: { ...fight.outcome },
    players: fight.players.map((e) => {
      const { burden: _, actionDir, ...player } = world.require(e, Player);
      const stamina = { ...world.require(e, Stamina) }, stats = { ...world.require(e, FighterStats) };
      const input = copyInput(world.require(e, PlayerInput));
      return { ...fighter(e), player: { ...player, actionDir: { ...actionDir } }, input, stamina, stats };
    }),
    enemies: fight.enemies.map((e) => {
      const { def: _, sense: _sense, move: _move, ...enemy } = world.require(e, Enemy);
      const lunge = world.get(e, LungeAttack), charge = world.get(e, ChargeAttack), weapon = world.get(e, WeaponAttack);
      const sidestep = world.get(e, Sidestep), skill = world.get(e, SkillAttack), stamina = world.get(e, Stamina);
      const pounce = world.get(e, PounceAttack), slam = world.get(e, SlamAttack);
      return {
        ...fighter(e), enemy,
        lunge: lunge ? { cooldown: lunge.cooldown } : null,
        charge: charge ? { cooldown: charge.cooldown, dir: { ...charge.dir } } : null,
        pounce: pounce ? { cooldown: pounce.cooldown, side: pounce.side, dir: { ...pounce.dir } } : null,
        slam: slam ? { cooldown: slam.cooldown } : null,
        weapon: weapon ? withoutDef(weapon) : null,
        sidestep: sidestep ? { dir: { ...sidestep.dir } } : null,
        skill: skill ? { cooldown: skill.cooldown, toSay: [...skill.toSay] } : null,
        stamina: stamina ? { value: stamina.value, regenDelay: stamina.regenDelay } : null,
      };
    }),
    hits: [...world.query(ActiveHit)].map(([e, { alreadyHit, ...hit }]) => ({
      ...hit, by: fighters.indexOf(e), alreadyHit: [...alreadyHit].map((target) => fighters.indexOf(target)),
    })),
    skills: [...world.query(SkillObject)].map(([, { caster, target, ignore, pos, dir, ...o }]) => ({
      ...o, pos: { ...pos }, dir: { ...dir }, caster: fighters.indexOf(caster),
      target: indexIn(fighters, target), ignore: indexIn(fighters, ignore),
    })),
  };
}

/** Makes `fight` (built from the same setup) exactly as `snap` says, its colliders included. */
export function loadFight(fight: Fight, snap: FightSnapshot): void {
  const { world, physics } = fight;
  const fighters = fightersOf(fight);
  const fighterAt = (i: number) => (i === -1 ? null : fighters[i]!);
  const place = (e: Entity, s: FighterSnapshot) => {
    const body = world.require(e, Body);
    Object.assign(body.pos, s.pos);
    Object.assign(body.vel, s.vel);
    physics.place(body.collider, body.pos);
    Object.assign(world.require(e, Health), s.health);
    world.add(e, Statuses, copyStatuses(s.statuses));
    const wielder = world.get(e, Wielder);
    if (wielder && s.wielder) {
      const { swing, ...rest } = s.wielder;
      Object.assign(wielder, rest, { swing: copySwing(swing) });
    }
    const { words, aim, target, ...skilled } = s.skilled;
    const copied = { words: [...words], aim: { ...aim }, target: fighterAt(target) };
    Object.assign(world.require(e, Skilled), skilled, copied);
  };
  // Every hitbox out first, then back in the snapshot's order: the order hits are checked in.
  for (const e of fighters) world.remove(e, ActiveHit);
  fight.players.forEach((e, i) => {
    const s = snap.players[i]!;
    place(e, s);
    Object.assign(world.require(e, Player), s.player, { actionDir: { ...s.player.actionDir } });
    world.require(e, Wielder).hands = handsOf(s.player.gear.equipment);
    Object.assign(world.require(e, PlayerInput), copyInput(s.input));
    Object.assign(world.require(e, Stamina), s.stamina);
    Object.assign(world.require(e, FighterStats), s.stats);
  });
  fight.enemies.forEach((e, i) => {
    const s = snap.enemies[i]!;
    place(e, s);
    Object.assign(world.require(e, Enemy), s.enemy);
    const lunge = world.get(e, LungeAttack), charge = world.get(e, ChargeAttack);
    if (lunge && s.lunge) lunge.cooldown = s.lunge.cooldown;
    if (charge && s.charge) Object.assign(charge, { cooldown: s.charge.cooldown, dir: { ...s.charge.dir } });
    const pounce = world.get(e, PounceAttack);
    if (pounce && s.pounce) Object.assign(pounce, { ...s.pounce, dir: { ...s.pounce.dir } });
    const slam = world.get(e, SlamAttack);
    if (slam && s.slam) slam.cooldown = s.slam.cooldown;
    const weapon = world.get(e, WeaponAttack);
    if (weapon && s.weapon) Object.assign(weapon, s.weapon);
    const sidestep = world.get(e, Sidestep);
    if (sidestep && s.sidestep) sidestep.dir = { ...s.sidestep.dir };
    const skill = world.get(e, SkillAttack), stamina = world.get(e, Stamina);
    if (skill && s.skill) Object.assign(skill, { cooldown: s.skill.cooldown, toSay: [...s.skill.toSay] });
    if (stamina && s.stamina) Object.assign(stamina, s.stamina);
  });
  for (const { by, alreadyHit, ...hit } of snap.hits) {
    world.add(fighters[by]!, ActiveHit, { ...hit, alreadyHit: new Set(alreadyHit.map((i) => fighters[i]!)) });
  }
  for (const [e] of world.query(SkillObject)) world.destroy(e);
  world.flush();
  for (const { caster, target, ignore, pos, dir, ...o } of snap.skills) {
    world.add(world.spawn(), SkillObject, {
      ...o, pos: { ...pos }, dir: { ...dir }, caster: fighters[caster]!, target: fighterAt(target),
      ignore: fighterAt(ignore),
    });
  }
  Object.assign(fight.outcome, snap.outcome);
  fight.steps = snap.steps;
  // Files the moved colliders where the next step's queries look for them.
  physics.step();
}

/**
 * A fingerprint of the state. Every number is rounded to 2 decimals first, so a last-bit difference between machines
 * (Math.sin in another browser) doesn't count until it grows into something that could be seen.
 */
export function hashFight(fight: Fight): number {
  return hashText(canonical(saveFight(fight)));
}

const HASH_DECIMALS = 2;

/** Keys sorted, so the order fields were made in doesn't matter. */
function canonical(value: unknown): string {
  if (typeof value === "number") return String(roundTo(value, HASH_DECIMALS) || 0);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${key}:${canonical(record[key])}`).join(",")}}`;
  }
  return String(value);
}

/** cyrb53: a quick 53-bit hash of a string (a fingerprint, not a lock). */
function hashText(text: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
