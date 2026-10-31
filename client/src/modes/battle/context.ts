import type {
  Entity, GearMove, GuardSide, Line, PageWrite, PileSnap, Skill, SwingDir, UseSpot, Vec3,
} from "@infinite-tower/shared";
import type { Fight, FightOutcome, PlayerSetup } from "@infinite-tower/shared/fight";
import type { Actions, Polled } from "../../core/actions.js";
import type { Settings } from "../../settings/settings.js";
import type { ArenaView } from "./camera.js";
import type { FightSync, StepEvent } from "./sync.js";

/** Seconds a decided fight waits before showing the result and taking the leave key. */
const RESULT_DELAY = 1;
export const resultShown = (outcome: FightOutcome): boolean =>
  outcome.state !== "fighting" && outcome.stateTime > RESULT_DELAY;
/** After a win the banner goes this long after the result, so the drops can be seen. */
export const AFTER_FIGHT_BANNER_TIME = 4;

export interface Correction { e: Entity; moved: Vec3 }

export interface BattleContext {
  // The last fight step's; a frame without a step keeps it.
  polled: Polled;
  actions: Actions;
  settings: Settings;
  /** The camera's orbit. Unlocked, its yaw is also the aim, and movement is camera-relative. */
  view: ArenaView;
  lock: Entity | null;
  guard: GuardSide;
  way: SwingDir;
  line: Line;
  who: PlayerSetup["who"][];
  /** Your own copy, from the encounter until the player leaves the arena. */
  fight: Fight | null;
  /** Keeps `fight` in line with the server's. */
  sync: FightSync | null;
  /** As the server says (its clock runs here, for when to show the result). */
  outcome: FightOutcome;
  afterFightMs: number | null;
  drops: PileSnap[];
  /** This frame's: what the fight's steps reported (a replayed step's again), the bodies a server's fight moved. */
  events: StepEvent[];
  corrections: Correction[];
  casts: Skill[];
  writes: PageWrite[];
  gearMoves: GearMove[];
  uses: UseSpot[];
}
