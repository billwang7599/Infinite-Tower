/** Battles, from a player's session: starting one (its fight runs in a BattleRoom), and what its end does to them. */
import {
  bagCounts, blessingsOf, Body, carriedCounts, coreAfterDeath, emptyEquipment, Enemy, packFor, PlayerInput, roundTo,
  type CoreLoss, type EnemyId, type Entity, type ItemCounts, type ServerMsgOf, type Vec2, type Vitals,
} from "@infinite-tower/shared";
import {
  ENEMY_START, ENEMY_START_YAW, PLAYER_START, type EnemySetup, type Fight, type FightSetup, type PlayerResult,
  type PlayerSetup,
} from "@infinite-tower/shared/fight";
import { BattleRoom, type Kept, type RoomHooks, type Seat } from "../battle/room.js";
import { fullVitals } from "../content/player.js";
import { ENEMIES, rollDrops } from "../enemies/index.js";
import type { Overworld } from "../overworld/overworld.js";
import { inViewWithSlack } from "../overworld/interact.js";
import type { Region, SpawnDef } from "../world/region.js";
import { getArena } from "../world/index.js";
import { regionOf } from "../world/world.js";
import type { GameSession } from "./session.js";
import { progressStory } from "./story.js";
import type { Uniques } from "./uniques.js";

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
/** Between a fallen enemy's body and its drops, so the body doesn't hide them. */
export const DROP_GAP_M = 0.5;

const randomSeed = (rng: () => number): number => Math.floor(rng() * 2 ** 32);

// Seeds (a swordsman's swings, sidesteps, where split Bolts start) are the server's pick, so a client can't choose.
export const foeOf = (id: EnemyId, rng: () => number): EnemySetup =>
  ({ def: ENEMIES[id].def, at: ENEMY_START, yaw: ENEMY_START_YAW, seed: randomSeed(rng) });

export const regionHere = (session: GameSession): Region =>
  regionOf(session.overworld.map, session.overworld.playerPos(session.me));

/** `sessions[i]` plays `setup.players[i]`; without shared `drops`, each gets its own. */
export function startFight(
  sessions: GameSession[], setup: FightSetup, seat: (session: GameSession) => Seat,
  from: { source?: Entity | null; drops?: ArenaDrops } = {}, hooks: RoomHooks = {},
): void {
  const room = new BattleRoom(setup, sessions.map(seat), hooks);
  sessions.forEach((s, i) => seatInBattle(s, room, i, {
    source: from.source ?? null, drops: from.drops ?? newDrops(s.overworld.playerPos(s.me)),
  }));
}

/** Held in the arena of the spawn it came from; tall grass has no spawn, so the region's. */
export function startBattle(
  session: GameSession, source: Entity | null, enemyId: EnemyId, spawn: SpawnDef | undefined,
): void {
  const { overworld } = session;
  const setup: FightSetup = {
    arena: getArena(spawn?.arenaId ?? regionHere(session).arenaId),
    players: [{ ...fighterOf(session), at: PLAYER_START }],
    enemies: [foeOf(enemyId, overworld.rng)],
  };
  const drops = newDrops(overworld.playerPos(session.me));
  startFight([session], setup, seatOf, { source, drops }, {
    onOver: (fight) => {
      if (source !== null) overworld.fightDecided(source);
      if (fight.outcome.state === "won") dropInArena(fight, drops, overworld, session.uniques);
    },
    onClosed: () => landDrops(overworld, drops),
  });
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
  const { bag, pack, equipment } = session.gear;
  return {
    vitals: session.vitals, stats: session.stats, core: session.core, burden: session.burden,
    gear: { bag, pack, equipment },
    book: session.skillbook, seed: randomSeed(session.overworld.rng), invulnerable: session.invulnerable,
    who: { name: session.name, character: session.character! }, blessings: blessingsOf(session.faith),
  };
}

const seatOf = (session: GameSession): Seat => ({
  link: session.link,
  onEnd: (result, after, kept) => settleBattle(session, result, after, kept),
});

function settleBattle(session: GameSession, result: PlayerResult, after: Vitals, { book, gear, core }: Kept): void {
  const battle = session.battle;
  if (!battle) return;
  battle.over = true;
  session.skillbook = book;
  // Gone with nothing won or lost: the save keeps what they came in with.
  if (result === "left" || result === "fighting") return;
  session.gear = { ...session.gear, ...gear };
  session.core = core;
  const won = result === "won";
  const { overworld } = session;
  const afterFightMs = battle.room.inArena(battle.seat) ? AFTER_FIGHT_MS : null;
  let lost: ItemCounts = {}, coreLost: CoreLoss = null, me = overworld.playerPos(session.me);

  if (won) {
    if (afterFightMs !== null) battle.drops.closesAtMs ??= Date.now() + afterFightMs;
    session.wins++;
    const { world, enemies } = battle.room.fight;
    progressStory(session, [], enemies.map((e) => world.require(e, Enemy).def.id));
    // A winner is standing, though a teammate's win may have left them down.
    session.vitals = { hp: Math.max(1, after.hp), stamina: after.stamina };
  } else {
    const { bag, pack, equipment } = session.gear;
    lost = carriedCounts({ bag, pack, equipment });
    session.gear = { ...session.gear, bag: { ...bag, items: [] }, pack: packFor(null), equipment: emptyEquipment() };
    dropWhereFell(battle, overworld, lost);
    me = session.wakeOnPad();
    session.core = coreAfterDeath(core);
    coreLost = session.core.steps < core.steps ? "step" : session.core.fill < core.fill ? "fill" : null;
    session.vitals = fullVitals(session.stats);
  }
  session.save();
  session.link.send({
    t: "battleResult", won, me, wins: session.wins, vitals: session.vitals,
    lost, gear: session.gear, skillbook: session.skillbook, afterFightMs, core: session.core, coreLost,
  });
}

export function sparSeat(session: GameSession, against: { spar: string } | { duel: string }): Seat {
  const before = { ...session.vitals };
  return { link: session.link, onEnd: (result, _after, kept) => settleSpar(session, result, before, kept, against) };
}

function settleSpar(
  session: GameSession, result: PlayerResult, before: Vitals, { book, gear, core }: Kept,
  against: { spar: string } | { duel: string },
): void {
  const battle = session.battle;
  if (!battle) return;
  battle.over = true;
  session.skillbook = book;
  session.gear = { ...session.gear, ...gear };
  session.core = core;
  session.vitals = before;
  const { world, enemies } = battle.room.fight;
  if (result === "won" && enemies.length > 0) {
    progressStory(session, [], enemies.map((e) => world.require(e, Enemy).def.id));
  }
  session.save();
  if (result === "left") return;
  session.link.send({
    t: "battleResult", won: result === "won", me: session.overworld.playerPos(session.me), wins: session.wins,
    vitals: session.vitals, lost: {}, gear: session.gear, skillbook: session.skillbook, afterFightMs: null,
    core: session.core, coreLost: null, ...against,
  });
}

/** Beside where the enemy fell, toward the arena's middle (or the players' side, from the middle). */
function dropSpot(fell: Vec2, enemyRadiusM: number): Vec2 {
  const awayM = enemyRadiusM + DROP_GAP_M, fromMiddleM = Math.hypot(fell.x, fell.z);
  const way = fromMiddleM > awayM ? { x: -fell.x / fromMiddleM, z: -fell.z / fromMiddleM } : { x: 0, z: -1 };
  return { x: roundTo(fell.x + way.x * awayM, 2), z: roundTo(fell.z + way.z * awayM, 2) };
}

function dropInArena({ world, enemies }: Fight, drops: ArenaDrops, overworld: Overworld, uniques: Uniques): void {
  for (const e of enemies) {
    const { def } = world.require(e, Enemy);
    const pile = overworld.holdPile(rollDrops(def.id, overworld.rng, (item) => uniques.isFree(item)));
    if (pile !== null) drops.piles = [...drops.piles, { pile, at: dropSpot(world.require(e, Body).pos, def.radius) }];
  }
}

function dropWhereFell({ room, seat, drops }: Battle, overworld: Overworld, lost: ItemCounts): void {
  const { pos } = room.fight.world.require(room.fight.players[seat]!, Body);
  const pile = overworld.holdPile(lost);
  if (pile !== null) drops.piles = [...drops.piles, { pile, at: { x: roundTo(pos.x, 2), z: roundTo(pos.z, 2) } }];
}

export function arenaPiles(drops: ArenaDrops, overworld: Overworld): ArenaPile[] {
  const lying = drops.piles.filter((p) => overworld.pileItems(p.pile) !== null);
  if (lying.length < drops.piles.length) drops.piles = lying;
  return drops.piles;
}

export function arenaPileInView({ room, seat, drops }: Battle, overworld: Overworld): Entity | null {
  const { world } = room.fight, me = room.fight.players[seat]!, aim = world.require(me, PlayerInput);
  const piles = arenaPiles(drops, overworld).map(({ pile, at }) => ({ pile, ...at }));
  return inViewWithSlack(world.require(me, Body).pos, { x: aim.aimX, z: aim.aimZ }, piles)?.pile ?? null;
}

/** All in one pile, so a death's leftovers and the enemy's aren't sacks stacked on one spot. */
function landDrops(overworld: Overworld, drops: ArenaDrops): void {
  const [into, ...rest] = arenaPiles(drops, overworld);
  drops.piles = [];
  if (!into) return;
  for (const { pile } of rest) {
    const items = overworld.pileItems(pile)!;
    overworld.addToPile(into.pile, bagCounts(items));
    overworld.setPileItems(pile, { ...items, items: [] });
  }
  overworld.landPile(into.pile, drops.home);
}
