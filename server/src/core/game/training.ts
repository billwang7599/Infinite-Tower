import { Enemy, type EnemyId, type Vitals } from "@infinite-tower/shared";
import {
  ENEMY_START, ENEMY_START_YAW, PLAYER_START, type FightSetup, type PlayerResult,
} from "@infinite-tower/shared/fight";
import { BattleRoom, type Kept } from "../battle/room.js";
import { ENEMIES } from "../enemies/index.js";
import { getArena } from "../world/index.js";
import { fighterOf, newDrops, seatInBattle } from "./battle.js";
import type { GameSession } from "./session.js";
import { progressStory } from "./story.js";

export const TRAINING_YIELD_SHARE = 0.1;

export function startTraining(session: GameSession, foe: EnemyId): void {
  const { overworld } = session;
  if (!session.inOverworld || !overworld.enterFight(session.me)) return;
  const def = ENEMIES[foe].def, before = { ...session.vitals };
  const setup: FightSetup = {
    arena: getArena(overworld.level.arenaId),
    yieldAt: TRAINING_YIELD_SHARE,
    players: [{ ...fighterOf(session), at: PLAYER_START }],
    enemies: [{ def, at: ENEMY_START, yaw: ENEMY_START_YAW, seed: Math.floor(overworld.rng() * 2 ** 32) }],
  };
  const room = new BattleRoom(setup, [{
    link: session.link, onEnd: (result, _after, kept) => settleTraining(session, result, before, def.name, kept),
  }]);
  seatInBattle(session, room, 0, { source: null, drops: newDrops(overworld.playerPos(session.me)) });
}

function settleTraining(
  session: GameSession, result: PlayerResult, before: Vitals, foe: string, { book, gear, core }: Kept,
): void {
  const battle = session.battle;
  if (!battle) return;
  battle.over = true;
  session.skillbook = book;
  session.gear = { ...session.gear, ...gear };
  session.core = core;
  session.vitals = before;
  if (result === "won") {
    const { world, enemies } = battle.room.fight;
    progressStory(session, [], enemies.map((e) => world.require(e, Enemy).def.id));
  }
  session.save();
  if (result === "left") return;
  session.link.send({
    t: "battleResult", won: result === "won", me: session.overworld.playerPos(session.me), wins: session.wins,
    vitals: session.vitals, lost: {}, gear: session.gear, skillbook: session.skillbook, afterFightMs: null,
    core: session.core, coreLost: null, spar: foe,
  });
}
