/** Battles, from a player's session: starting one (its fight runs in a BattleRoom), and what its end does to them. */
import {
  ARENA_PILE_LOOK_RAD, ARENA_PILE_RANGE_M, bagCounts, Body, Enemy, pileInView, PlayerInput, roundTo, SLOTS,
  type Carried, type EnemyId, type Entity, type ItemCounts, type ItemId, type ServerMsgOf, type Skillbook, type Vec2,
  type Vitals,
} from "@infinite-tower/shared";
import {
  ENEMY_START, ENEMY_START_YAW, PLAYER_START, type Fight, type FightSetup, type PlayerResult, type PlayerSetup,
} from "@infinite-tower/shared/fight";
import { BattleRoom, type Seat } from "../battle/room.js";
import { fullVitals, STARTER_KIT } from "../content/player.js";
import { ENEMIES, rollDrops } from "../enemies/index.js";
import type { Overworld } from "../overworld/overworld.js";
import type { SpawnDef } from "../world/level.js";
import { getArena } from "../world/index.js";
import type { GameSession } from "./session.js";

export interface Battle {
  /** The actor that started it, or null for tall grass. */
  source: Entity | null;
  room: BattleRoom;
  /** Which of the room's players this one is. */
  seat: number;
  /** Over and settled: they're still in the arena until they leave it. */
  over: boolean;
  /** The room's, shared by everyone in it. */
  drops: ArenaDrops;
  shownDrops: ArenaPile[] | null;
}

/** Its pile is held off the overworld's map until the arena empties. */
export interface ArenaPile {
  pile: Entity;
  at: Vec2;
}

export interface ArenaDrops {
  /** Where the fight began on the overworld: what's left lands there. */
  home: Vec2;
  /** Replaced, never changed in place: sessions spot a change by reference. */
  piles: ArenaPile[];
  /** When the winners still there are sent out, as Date.now(). */
  closesAtMs: number | null;
}

export const newDrops = (home: Vec2): ArenaDrops => ({ home: { x: home.x, z: home.z }, piles: [], closesAtMs: null });

export const AFTER_FIGHT_MS = 5 * 60 * 1000;
/** Leeway on the reach to the arena's drops and on where you look: the server's copy of you trails the client's. */
export const ARENA_LAG_SLACK_M = 1;
export const ARENA_LOOK_SLACK_RAD = (15 * Math.PI) / 180;
/** Between a fallen enemy's body and its drops, so the body doesn't hide them. */
export const DROP_GAP_M = 0.5;

const randomSeed = (rng: () => number): number => Math.floor(rng() * 2 ** 32);

/** Held in the arena of the spawn it came from; tall grass has no spawn, so the level's. */
export function startBattle(
  session: GameSession, source: Entity | null, enemyId: EnemyId, spawn: SpawnDef | undefined,
): void {
  const { overworld } = session;
  const setup: FightSetup = {
    arena: getArena(spawn?.arenaId ?? overworld.level.arenaId),
    players: [{ ...fighterOf(session), at: PLAYER_START }],
    // Seeds (a swordsman's swings, sidesteps, where split Bolts start) are the server's pick, so a client can't choose.
    enemies: [{ def: ENEMIES[enemyId].def, at: ENEMY_START, yaw: ENEMY_START_YAW, seed: randomSeed(overworld.rng) }],
  };
  const drops = newDrops(overworld.playerPos(session.me));
  const room: BattleRoom = new BattleRoom(setup, [seatOf(session)], {
    onOver: () => {
      if (source !== null) overworld.fightDecided(source);
      if (room.fight.outcome.state === "won") dropInArena(room.fight, drops, overworld);
    },
    onClosed: () => landDrops(overworld, drops),
  });
  seatInBattle(session, room, 0, { source, drops });
}

export function joinBattle(joiner: GameSession, host: GameSession): void {
  const hosted = host.battle!, { room } = hosted, reason = room.refusal;
  if (reason) {
    joiner.link.send({ t: "joinRefused", reason });
    return;
  }
  const seat = room.join(seatOf(joiner), fighterOf(joiner))!;
  joiner.overworld.enterFight(joiner.me);
  seatInBattle(joiner, room, seat, { source: null, drops: hosted.drops }, {
    joined: { host: host.name, step: room.fight.steps, fight: room.fight.save() },
  });
}

export function seatInBattle(
  session: GameSession, room: BattleRoom, seat: number, from: Pick<Battle, "source" | "drops">,
  extra: Pick<ServerMsgOf<"encounter">, "joined"> = {},
): void {
  session.battle = { ...from, room, seat, over: false, shownDrops: null };
  session.link.send({
    t: "encounter", source: from.source, me: session.overworld.playerPos(session.me), seat, setup: room.setup,
    ...extra,
  });
}

/** Closes their bag: it isn't taken into a fight. */
export function fighterOf(session: GameSession): Omit<PlayerSetup, "at"> {
  session.closeBag();
  const { bag, equipment } = session.gear;
  return {
    vitals: session.vitals, stats: session.stats, burden: session.burden, gear: { bag, equipment },
    book: session.skillbook, seed: randomSeed(session.overworld.rng), invulnerable: session.invulnerable,
    who: { name: session.name, character: session.character! },
  };
}

const seatOf = (session: GameSession): Seat => ({
  link: session.link,
  onEnd: (result, after, book, gear) => settleBattle(session, result, after, book, gear),
});

/** `after`, `book` and `gear`: the HP, stamina, pages and gear the fight left them. */
function settleBattle(
  session: GameSession, result: PlayerResult, after: Vitals, book: Skillbook, gear: Carried,
): void {
  const battle = session.battle;
  if (!battle) return;
  battle.over = true;
  session.skillbook = book;
  // Gone with nothing won or lost: the save keeps what they came in with.
  if (result === "left" || result === "fighting") return;
  session.gear = { ...session.gear, ...gear };
  const won = result === "won";
  const { overworld } = session;
  const afterFightMs = battle.room.inArena(battle.seat) ? AFTER_FIGHT_MS : null;
  let lost: ItemCounts = {};

  if (won) {
    if (afterFightMs !== null) battle.drops.closesAtMs ??= Date.now() + afterFightMs;
    session.wins++;
    // A winner is standing, though a teammate's win may have left them down.
    session.vitals = { hp: Math.max(1, after.hp), stamina: after.stamina };
  } else {
    // Dying is hardcore: all that's carried is gone but the starter kit, which stays put.
    const kept = (item: ItemId) => STARTER_KIT.includes(item);
    const { bag } = session, equipment = { ...session.gear.equipment };
    lost = bagCounts({ ...bag, items: bag.items.filter((s) => !kept(s.item)) });
    for (const slot of SLOTS) {
      const item = equipment[slot];
      if (item === null || kept(item)) continue;
      lost[item] = (lost[item] ?? 0) + 1;
      equipment[slot] = null;
    }
    session.gear = { ...session.gear, bag: { ...bag, items: bag.items.filter((s) => kept(s.item)) }, equipment };
    overworld.place(session.me, overworld.level.spawn);
    session.vitals = fullVitals(session.stats);
  }
  session.save();
  session.link.send({
    t: "battleResult", won, me: overworld.playerPos(session.me), wins: session.wins, vitals: session.vitals,
    lost, gear: session.gear, skillbook: session.skillbook, afterFightMs,
  });
}

/** Beside where the enemy fell, toward the arena's middle (or the players' side, from the middle). */
function dropSpot(fell: Vec2, enemyRadiusM: number): Vec2 {
  const awayM = enemyRadiusM + DROP_GAP_M, fromMiddleM = Math.hypot(fell.x, fell.z);
  const way = fromMiddleM > awayM ? { x: -fell.x / fromMiddleM, z: -fell.z / fromMiddleM } : { x: 0, z: -1 };
  return { x: roundTo(fell.x + way.x * awayM, 2), z: roundTo(fell.z + way.z * awayM, 2) };
}

/** Rolled once for the fight, whoever won it: the winners share what drops. */
function dropInArena({ world, enemies }: Fight, drops: ArenaDrops, overworld: Overworld): void {
  for (const e of enemies) {
    const { def } = world.require(e, Enemy);
    const pile = overworld.holdPile(rollDrops(def.id, overworld.rng));
    if (pile !== null) drops.piles = [...drops.piles, { pile, at: dropSpot(world.require(e, Body).pos, def.radius) }];
  }
}

export function arenaPiles(drops: ArenaDrops, overworld: Overworld): ArenaPile[] {
  const lying = drops.piles.filter((p) => overworld.pileItems(p.pile) !== null);
  if (lying.length < drops.piles.length) drops.piles = lying;
  return drops.piles;
}

/** As the client picks it (pileInView), looking where the last input the server ran was aimed. */
export function arenaPileInView({ room, seat, drops }: Battle, overworld: Overworld): Entity | null {
  const { world } = room.fight, me = room.fight.players[seat]!, aim = world.require(me, PlayerInput);
  const piles = arenaPiles(drops, overworld).map(({ pile, at }) => ({ pile, ...at }));
  const reachM = ARENA_PILE_RANGE_M + ARENA_LAG_SLACK_M, lookRad = ARENA_PILE_LOOK_RAD + ARENA_LOOK_SLACK_RAD;
  const seen = pileInView(world.require(me, Body).pos, { x: aim.aimX, z: aim.aimZ }, piles, reachM, lookRad);
  return seen?.pile ?? null;
}

function landDrops(overworld: Overworld, drops: ArenaDrops): void {
  for (const { pile } of arenaPiles(drops, overworld)) overworld.landPile(pile, drops.home);
  drops.piles = [];
}
