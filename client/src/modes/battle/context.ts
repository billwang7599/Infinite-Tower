/** What arena systems need besides the World. */
import type { Scene, ShadowGenerator, UniversalCamera } from "@babylonjs/core";
import type { ArenaDef, World } from "@infinite-tower/shared";
import type { Fight, FightOutcome } from "@infinite-tower/shared/fight";
import type { Polled } from "../../core/actions.js";
import type { Mouse } from "../../core/mouse.js";
import type { Settings } from "../../settings/settings.js";
import type { Materials } from "./materials.js";
import type { FightSync } from "./sync.js";

/** Seconds a decided fight waits before showing the result and taking the leave key. */
const RESULT_DELAY = 1;
export const resultShown = (outcome: FightOutcome): boolean =>
  outcome.state !== "fighting" && outcome.stateTime > RESULT_DELAY;

export interface BattleContext {
  /** The game's world: the arena's scenery lives here. The fighters live in `fight.world`. */
  world: World;
  scene: Scene;
  camera: UniversalCamera;
  // The last fight step's; a frame without a step keeps it.
  polled: Polled;
  /** Its movement turns the camera; its buttons come through `actions`. */
  mouse: Mouse;
  settings: Settings;
  materials: Materials;
  /** The sun's shadow maps (casters are added to it); not the blob shadows under the sprites. */
  sunShadows: ShadowGenerator;
  arena: ArenaDef;
  /** The camera's orbit (radians). Yaw is also the aim, and movement is camera-relative. */
  view: { yaw: number; pitch: number };
  /** Your own copy, from the encounter until the player leaves the arena. */
  fight: Fight | null;
  /** Keeps `fight` in line with the server's. */
  sync: FightSync | null;
  /** As the server says (its clock runs here, for when to show the result). */
  outcome: FightOutcome;
  /** Camera shake amplitude, decaying. Hard hits add to it. */
  shake: number;
}
