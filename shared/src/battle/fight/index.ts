// The arena fight's simulation, "@infinite-tower/shared/fight". Its own entry point because it brings Rapier (a few
// MB): only code that runs a fight imports it, so the title screen's bundle and the rest of the server don't load it.
export { Fight } from "./fight.js";
export type { FightEvent, FightOutcome, FightState } from "./context.js";
export { LEAVING_LOSES, MAX_FIGHT_TIME, playerResult, type PlayerResult } from "./outcome.js";
export { initPhysics } from "./physics/init.js";
export type { ArenaPhysics } from "./physics/arena-physics.js";
export {
  ENEMY_START, ENEMY_START_YAW, PLAYER_START, type EnemySetup, type FightSetup, type PlayerSetup,
} from "./setup.js";
export type { EnemySnapshot, FightSnapshot, HitSnapshot, PlayerSnapshot } from "./state.js";
