/**
 * A fight's whole state, out and back in. The server sends it to a client whose copy has gone its own way (and once
 * more as the fight is decided); the client loads it into its copy and replays its own inputs since. Plain JSON and
 * exact: numbers survive JSON as they are. Only what changes during a fight is in it, because the setup (arena,
 * defs, stats, burden, maximums) is the same on both sides; an enemy's `sense` and `move` aren't either, as its
 * brain works them out afresh every step before anything reads them. The physics world is rebuilt from it: Rapier
 * simulates nothing here, so a collider is just where its body is. A fight's only random numbers are a sword
 * attack's, from the seed it keeps (`rng`), which is in here and so in the hash.
 */
import type { Entity } from "../../core/ecs.js";
import type { Vec2, Vec3 } from "../../core/math.js";
import {
  ActiveHit, Body, ChargeAttack, Enemy, Health, LungeAttack, Player, Stamina, SwordAttack, type ActiveHitData,
  type EnemyData, type HealthData, type PlayerData, type StaminaData, type SwordAttackData,
} from "../components.js";
import { copyInput, PlayerInput, type PlayerInputData } from "../input.js";
import type { FightOutcome } from "./context.js";
import type { Fight } from "./fight.js";

export interface FighterSnapshot { pos: Vec3; vel: Vec3; health: Omit<HealthData, "max"> }

export interface PlayerSnapshot extends FighterSnapshot {
  player: Omit<PlayerData, "burden">;
  /** The input the player's last step ran with (what they hold). */
  input: PlayerInputData;
  stamina: Omit<StaminaData, "max">;
}

export interface EnemySnapshot extends FighterSnapshot {
  enemy: Omit<EnemyData, "def" | "sense" | "move">;
  lunge: { cooldown: number } | null;
  charge: { cooldown: number; dir: Vec2 } | null;
  sword: Omit<SwordAttackData, "def"> | null;
}

/** A live hitbox: whose it is and whom it has hit, as fighter indices (the players in seat order, then enemies). */
export interface HitSnapshot extends Omit<ActiveHitData, "alreadyHit"> { by: number; alreadyHit: number[] }

export interface FightSnapshot {
  /** Steps run: the fight is as it was after this one. */
  steps: number;
  outcome: FightOutcome;
  players: PlayerSnapshot[];
  enemies: EnemySnapshot[];
  /** In the order the fight checks them. */
  hits: HitSnapshot[];
}

const fightersOf = (fight: Fight): Entity[] => [...fight.players, ...fight.enemies];

function withoutDef({ def: _, ...state }: SwordAttackData): Omit<SwordAttackData, "def"> {
  return state;
}

export function saveFight(fight: Fight): FightSnapshot {
  const { world } = fight;
  const fighters = fightersOf(fight);
  const fighter = (e: Entity): FighterSnapshot => {
    const { pos, vel } = world.require(e, Body);
    const { max: _, ...health } = world.require(e, Health);
    return { pos: { ...pos }, vel: { ...vel }, health };
  };
  return {
    steps: fight.steps,
    outcome: { ...fight.outcome },
    players: fight.players.map((e) => {
      const { burden: _, actionDir, ...player } = world.require(e, Player);
      const { max: _max, ...stamina } = world.require(e, Stamina);
      const input = copyInput(world.require(e, PlayerInput));
      return { ...fighter(e), player: { ...player, actionDir: { ...actionDir } }, input, stamina };
    }),
    enemies: fight.enemies.map((e) => {
      const { def: _, sense: _sense, move: _move, ...enemy } = world.require(e, Enemy);
      const lunge = world.get(e, LungeAttack), charge = world.get(e, ChargeAttack), sword = world.get(e, SwordAttack);
      return {
        ...fighter(e), enemy,
        lunge: lunge ? { cooldown: lunge.cooldown } : null,
        charge: charge ? { cooldown: charge.cooldown, dir: { ...charge.dir } } : null,
        sword: sword ? withoutDef(sword) : null,
      };
    }),
    hits: [...world.query(ActiveHit)].map(([e, { alreadyHit, ...hit }]) => ({
      ...hit, by: fighters.indexOf(e), alreadyHit: [...alreadyHit].map((target) => fighters.indexOf(target)),
    })),
  };
}

/** Makes `fight` (built from the same setup) exactly as `snap` says, its colliders included. */
export function loadFight(fight: Fight, snap: FightSnapshot): void {
  const { world, physics } = fight;
  const fighters = fightersOf(fight);
  const place = (e: Entity, s: FighterSnapshot) => {
    const body = world.require(e, Body);
    Object.assign(body.pos, s.pos);
    Object.assign(body.vel, s.vel);
    physics.place(body.collider, body.pos);
    Object.assign(world.require(e, Health), s.health);
  };
  // Every hitbox out first, then back in the snapshot's order: the order hits are checked in.
  for (const e of fighters) world.remove(e, ActiveHit);
  fight.players.forEach((e, i) => {
    const s = snap.players[i]!;
    place(e, s);
    Object.assign(world.require(e, Player), s.player, { actionDir: { ...s.player.actionDir } });
    Object.assign(world.require(e, PlayerInput), copyInput(s.input));
    Object.assign(world.require(e, Stamina), s.stamina);
  });
  fight.enemies.forEach((e, i) => {
    const s = snap.enemies[i]!;
    place(e, s);
    Object.assign(world.require(e, Enemy), s.enemy);
    const lunge = world.get(e, LungeAttack), charge = world.get(e, ChargeAttack);
    if (lunge && s.lunge) lunge.cooldown = s.lunge.cooldown;
    if (charge && s.charge) Object.assign(charge, { cooldown: s.charge.cooldown, dir: { ...s.charge.dir } });
    const sword = world.get(e, SwordAttack);
    if (sword && s.sword) Object.assign(sword, s.sword);
  });
  for (const { by, alreadyHit, ...hit } of snap.hits) {
    world.add(fighters[by]!, ActiveHit, { ...hit, alreadyHit: new Set(alreadyHit.map((i) => fighters[i]!)) });
  }
  Object.assign(fight.outcome, snap.outcome);
  fight.steps = snap.steps;
  // Files the moved colliders where the next step's queries look for them.
  physics.step();
}
