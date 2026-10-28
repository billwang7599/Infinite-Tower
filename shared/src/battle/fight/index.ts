// The arena fight, "@infinite-tower/shared/fight". Its own entry point because it brings Rapier (a few MB), so the
// title screen's bundle and the rest of the server don't load it.
export { Fight } from "./fight.js";
export type { FightEvent, FightOutcome, FightState } from "./context.js";
export { LEAVING_LOSES, MAX_FIGHT_TIME, playerResult, type PlayerResult } from "./outcome.js";
export { initPhysics } from "./physics/init.js";
export {
  ENEMY_START, ENEMY_START_YAW, PLAYER_START, type EnemySetup, type FightSetup, type PlayerSetup,
} from "./setup.js";
export { chant, releaseChant, startCast } from "./skills/skilled.js";
export type { FightSnapshot } from "./state.js";
