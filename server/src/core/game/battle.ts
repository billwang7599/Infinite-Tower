/**
 * Battles, from a player's session: starting one (the fight itself runs in a BattleRoom, core/battle/), what its end
 * does to the player (wins, loot, the bag, HP and stamina, saved at once), and leaving the arena afterwards.
 */
import { bagCounts, type Entity, type ItemCounts, type Vitals } from "@infinite-tower/shared";
import {
  ENEMY_START, ENEMY_START_YAW, PLAYER_START, type FightSetup, type PlayerResult,
} from "@infinite-tower/shared/fight";
import { BattleRoom } from "../battle/room.js";
import { rollDrops } from "../content/drops.js";
import { ENEMIES, type EnemyId } from "../content/enemies.js";
import { fullVitals } from "../content/player.js";
import { packLoot } from "./inventory.js";
import type { GameSession } from "./session.js";

export interface Battle {
  /** The actor that started it (removed if you win), or null for tall grass. */
  source: Entity | null;
  enemyId: EnemyId;
  room: BattleRoom;
  /** Which of the room's players this one is. */
  seat: number;
  /** The fight is over for the player (and settled): they're still in the arena until they leave it. */
  over: boolean;
}

const randomSeed = (rng: () => number): number => Math.floor(rng() * 2 ** 32);

export function startBattle(session: GameSession, source: Entity | null, enemyId: EnemyId): void {
  const { overworld, vitals } = session;
  const setup: FightSetup = {
    arena: overworld.level.arena,
    players: [{ at: PLAYER_START, vitals, stats: session.stats, burden: session.burden }],
    // Its random numbers' seed (a swordsman's swings) is the server's pick, so a client can't choose it.
    enemies: [{ def: ENEMIES[enemyId], at: ENEMY_START, yaw: ENEMY_START_YAW, seed: randomSeed(overworld.rng) }],
  };
  const room = new BattleRoom(setup, [{
    link: session.link,
    onEnd: (result, after) => settleBattle(session, result, after),
  }]);
  session.battle = { source, enemyId, room, seat: 0, over: false };
  overworld.resetWalk(0);
  session.link.send({ t: "encounter", source, me: overworld.playerPos(), seat: 0, setup });
}

/** The arena's Leave key, after the result: back to the overworld. Mid-fight it does nothing. */
export function leaveArena(session: GameSession): void {
  if (session.battle?.over) session.battle = null;
}

/** The fight is over for the player: `result`, with `after` the HP and stamina it left them. */
function settleBattle(session: GameSession, result: PlayerResult, after: Vitals): void {
  const battle = session.battle;
  if (!battle) return;
  battle.over = true;
  // Gone with nothing won or lost: the save keeps what they came in with.
  if (result === "left" || result === "fighting") return;
  const won = result === "won";
  const { overworld } = session;
  const loot = won ? rollDrops(battle.enemyId, overworld.rng) : {};
  const packed = packLoot(session.bag, loot);
  let lost: ItemCounts = {};

  if (won) {
    session.bag = packed.bag;
    session.wins++;
    // The spawner replaces it.
    if (battle.source !== null && overworld.world.isAlive(battle.source)) overworld.world.destroy(battle.source);
    overworld.world.flush();
    // A winner is standing (a teammate's win, later, could leave them down).
    session.vitals = { hp: Math.max(1, after.hp), stamina: after.stamina };
  } else {
    // Dying is hardcore: everything carried is gone. You wake up back at the start, rested.
    lost = bagCounts(session.bag);
    session.bag = { ...session.bag, items: [] };
    overworld.place(overworld.level.spawn);
    session.vitals = fullVitals(session.stats);
  }
  overworld.resetWalk(overworld.level.safeTime);
  session.save();
  session.link.send({
    t: "battleResult", won, me: overworld.playerPos(), wins: session.wins, vitals: session.vitals,
    loot, leftBehind: packed.left, lost, bag: session.bag,
  });
}
