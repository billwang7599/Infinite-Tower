import {
  Body, type Entity, type GearMove, type PageWrite, type PileSnap, type Skill, type SwingDir, type UseSpot, type Vec3,
  type World,
} from "@infinite-tower/shared";
import type { Fight, FightOutcome, PlayerSetup } from "@infinite-tower/shared/fight";
import type { Actions, Polled } from "../../core/actions.js";
import type { Settings } from "../../settings/settings.js";
import type { ArenaView } from "./camera.js";
import type { FreeCamera } from "./aim.js";
import type { Stun } from "./stun.js";
import type { FightSync, StepEvent } from "./sync.js";

/** Seconds a decided fight waits before showing the result and taking the leave key. */
const RESULT_DELAY = 1;
export const resultShown = (outcome: FightOutcome): boolean =>
  outcome.state !== "fighting" && outcome.stateTime > RESULT_DELAY;
/** After a win the banner goes this long after the result, so the drops can be seen. */
export const AFTER_FIGHT_BANNER_TIME = 4;

export interface Correction { e: Entity; moved: Vec3 }

export class Blend {
  alpha = 1;
  private readonly before = new Map<Entity, Vec3>();

  keep(world: World, fighters: readonly Entity[]): void {
    for (const e of fighters) this.before.set(e, { ...world.require(e, Body).pos });
  }

  moved(e: Entity, by: Vec3): void {
    const was = this.before.get(e);
    if (was) this.before.set(e, { x: was.x + by.x, y: was.y + by.y, z: was.z + by.z });
  }

  clear(): void {
    this.before.clear();
  }

  pos(world: World, e: Entity): Vec3 {
    const now = world.require(e, Body).pos, was = this.before.get(e) ?? now, a = this.alpha;
    return { x: was.x + (now.x - was.x) * a, y: was.y + (now.y - was.y) * a, z: was.z + (now.z - was.z) * a };
  }
}

export interface BattleContext {
  // The last fight step's; a frame without a step keeps it.
  polled: Polled;
  actions: Actions;
  settings: Settings;
  view: ArenaView;
  blend: Blend;
  lock: Entity | null;
  freeCamera: FreeCamera;
  zoomM: number;
  way: SwingDir;
  stun: Stun;
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
