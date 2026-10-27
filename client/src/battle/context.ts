/** What arena systems need besides the World. Created by createBattle (battle.ts). */
import type { Scene, ShadowGenerator, UniversalCamera } from "@babylonjs/core";
import type { ArenaDef, World } from "@infinite-tower/shared";
import type { Fight, FightOutcome } from "@infinite-tower/shared/fight";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import type { Settings } from "../settings/settings.js";
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
  keyboard: Keyboard;
  mouse: Mouse;
  settings: Settings;
  materials: Materials;
  /** The sun's shadow maps (casters are added to it); not the blob shadows under the sprites. */
  sunShadows: ShadowGenerator;
  /** The current arena (from the server's encounter). */
  arena: ArenaDef;
  /**
   * Orbit angles of the camera (radians), from the mouse or the turn / tilt keys. Yaw is also the aim direction:
   * forward = (sin yaw, cos yaw). Movement is camera-relative.
   */
  view: { yaw: number; pitch: number };
  /** The fight being drawn (your own copy, run at once), from the encounter until the player leaves the arena. */
  fight: Fight | null;
  /** Keeps `fight` in line with the server's (sync.ts); its `stats` count the checks and corrections. */
  sync: FightSync | null;
  /** How the fight stands, as the server says (its clock runs here, for when to show the result). */
  outcome: FightOutcome;
  /** Camera shake amplitude, decays over time. Hard hits add to it (addImpactShake, systems/camera.ts). */
  shake: number;
}
