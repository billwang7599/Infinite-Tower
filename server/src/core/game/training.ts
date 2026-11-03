import type { EnemyId } from "@infinite-tower/shared";
import { PLAYER_START, type FightSetup } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../enemies/index.js";
import { getArena } from "../world/index.js";
import { fighterOf, foeOf, regionHere, sparSeat, startFight } from "./battle.js";
import type { GameSession } from "./session.js";

export const TRAINING_YIELD_SHARE = 0.1;

export function startTraining(session: GameSession, foe: EnemyId): void {
  const { overworld } = session;
  if (!session.inOverworld || !overworld.enterFight(session.me)) return;
  const setup: FightSetup = {
    arena: getArena(regionHere(session).arenaId),
    yieldAt: TRAINING_YIELD_SHARE,
    players: [{ ...fighterOf(session), at: PLAYER_START }],
    enemies: [foeOf(foe, overworld.rng)],
  };
  startFight([session], setup, (s) => sparSeat(s, { spar: ENEMIES[foe].def.name }));
}
