/** Battles, from a player's session: starting one (its fight runs in a BattleRoom), and what its end does to them. */
import {
  addItem, bagCounts, blankSkillbook, starterEquipment, type Bag, type Carried, type EnemyId, type Entity,
  type ItemCounts, type ItemId, type ServerMsgOf, type Skillbook, type Vitals,
} from "@infinite-tower/shared";
import {
  ENEMY_START, ENEMY_START_YAW, PLAYER_START, type FightSetup, type PlayerResult, type PlayerSetup,
} from "@infinite-tower/shared/fight";
import { BattleRoom, type Seat } from "../battle/room.js";
import { fullVitals } from "../content/player.js";
import { ENEMIES, rollDrops } from "../enemies/index.js";
import type { SpawnDef } from "../world/level.js";
import { getArena } from "../world/index.js";
import type { GameSession } from "./session.js";

export interface Battle {
  /** The actor that started it, or null for tall grass. */
  source: Entity | null;
  /** null in a duel. */
  enemyId: EnemyId | null;
  room: BattleRoom;
  /** Which of the room's players this one is. */
  seat: number;
  /** Over and settled: they're still in the arena until they leave it. */
  over: boolean;
}

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
  const room = new BattleRoom(setup, [seatOf(session)], () => {
    if (source !== null) overworld.fightDecided(source);
  });
  seatInBattle(session, room, 0, { source, enemyId });
}

export function joinBattle(joiner: GameSession, host: GameSession): void {
  const hosted = host.battle!, { room } = hosted, reason = room.refusal;
  if (reason) {
    joiner.link.send({ t: "joinRefused", reason });
    return;
  }
  const seat = room.join(seatOf(joiner), fighterOf(joiner))!;
  joiner.overworld.enterFight(joiner.me);
  seatInBattle(joiner, room, seat, { source: null, enemyId: hosted.enemyId }, {
    joined: { host: host.name, step: room.fight.steps, fight: room.fight.save() },
  });
}

export function seatInBattle(
  session: GameSession, room: BattleRoom, seat: number, from: Pick<Battle, "source" | "enemyId">,
  extra: Pick<ServerMsgOf<"encounter">, "opponent" | "joined"> = {},
): void {
  session.battle = { ...from, room, seat, over: false };
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

/** `loot` packed into `bag` where it fits; `left` is what there was no room for. */
export function packLoot(bag: Bag, loot: ItemCounts): { bag: Bag; left: ItemCounts } {
  let packed = bag;
  const left: ItemCounts = {};
  for (const [item, count] of Object.entries(loot) as [ItemId, number][]) {
    const added = addItem(packed, item, count);
    packed = added.bag;
    if (added.left > 0) left[item] = added.left;
  }
  return { bag: packed, left };
}

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
  const loot = won && battle.enemyId ? rollDrops(battle.enemyId, overworld.rng) : {};
  const packed = packLoot(session.bag, loot);
  let lost: ItemCounts = {};

  if (won) {
    session.bag = packed.bag;
    session.wins++;
    // A winner is standing, though a teammate's win may have left them down.
    session.vitals = { hp: Math.max(1, after.hp), stamina: after.stamina };
  } else {
    // Dying is hardcore: everything carried is gone. You wake at the start, rested, with a fresh sword and blank book.
    lost = bagCounts(session.bag);
    session.gear = { ...session.gear, bag: { ...session.bag, items: [] }, equipment: starterEquipment() };
    session.skillbook = blankSkillbook();
    overworld.place(session.me, overworld.level.spawn);
    session.vitals = fullVitals(session.stats);
  }
  session.save();
  session.link.send({
    t: "battleResult", won, me: overworld.playerPos(session.me), wins: session.wins, vitals: session.vitals,
    loot, leftBehind: packed.left, lost, gear: session.gear, skillbook: session.skillbook,
  });
}
