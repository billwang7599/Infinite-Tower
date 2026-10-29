/** Battles, from a player's session: starting one (its fight runs in a BattleRoom), and what its end does to them. */
import {
  addItem, bagCounts, blankSkillbook, starterEquipment, type Bag, type Carried, type EnemyId, type Entity,
  type ItemCounts, type ItemId, type Skillbook, type Vitals,
} from "@infinite-tower/shared";
import {
  ENEMY_START, ENEMY_START_YAW, PLAYER_START, type FightSetup, type PlayerResult,
} from "@infinite-tower/shared/fight";
import { BattleRoom } from "../battle/room.js";
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

export const randomSeed = (rng: () => number): number => Math.floor(rng() * 2 ** 32);

/** Held in the arena of the spawn it came from; tall grass has no spawn, so the level's. */
export function startBattle(
  session: GameSession, source: Entity | null, enemyId: EnemyId, spawn: SpawnDef | undefined,
): void {
  session.closeBag();
  const { overworld, vitals } = session;
  const { bag, equipment } = session.gear;
  const setup: FightSetup = {
    arena: getArena(spawn?.arenaId ?? overworld.level.arenaId),
    players: [{
      at: PLAYER_START, vitals, stats: session.stats, burden: session.burden, gear: { bag, equipment },
      book: session.skillbook, seed: randomSeed(overworld.rng), invulnerable: session.invulnerable,
    }],
    // Seeds (a swordsman's swings, sidesteps, where split Bolts start) are the server's pick, so a client can't choose.
    enemies: [{ def: ENEMIES[enemyId].def, at: ENEMY_START, yaw: ENEMY_START_YAW, seed: randomSeed(overworld.rng) }],
  };
  const room = new BattleRoom(setup, [{
    link: session.link,
    onEnd: (result, after, book, gear) => settleBattle(session, result, after, book, gear),
  }]);
  session.battle = { source, enemyId, room, seat: 0, over: false };
  session.link.send({ t: "encounter", source, me: overworld.playerPos(session.me), seat: 0, setup });
}

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
  session.overworld.fightDecided(session.me);
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
    // A winner is standing (a teammate's win, later, could leave them down).
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
