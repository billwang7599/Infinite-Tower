import type { EnemyId, Vec3 } from "@infinite-tower/shared";
import { PLAYER_START, type FightSetup } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../enemies/index.js";
import { getArena } from "../world/index.js";
import { fighterOf, foeOf, regionHere, sparSeat, startFight } from "./battle.js";
import type { GameSession } from "./session.js";

export const TRAINING_YIELD_SHARE = 0.1;
const DUMMY_ROW = { aheadM: 6, gapM: 2.5 };
export const DUMMY_SPOTS: readonly Vec3[] = [-1, 0, 1].map((i) =>
  ({ x: PLAYER_START.x + i * DUMMY_ROW.gapM, y: PLAYER_START.y, z: PLAYER_START.z + DUMMY_ROW.aheadM }));

export function startTraining(session: GameSession, foe: EnemyId): void {
  const { overworld } = session;
  if (!session.inOverworld || !overworld.enterFight(session.me)) return;
  const setup: FightSetup = {
    arena: getArena(regionHere(session).arenaId),
    yieldAt: TRAINING_YIELD_SHARE,
    players: [{ ...fighterOf(session), at: PLAYER_START }],
    enemies: ENEMIES[foe].def.dummy
      ? DUMMY_SPOTS.map((at) => ({ ...foeOf(foe, overworld.rng), at }))
      : [foeOf(foe, overworld.rng)],
  };
  startFight([session], setup, (s) => sparSeat(s, { spar: ENEMIES[foe].def.name }));
}
