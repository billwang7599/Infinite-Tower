/** What arena systems need besides the World. Created by createBattle (battle.ts). */
import type { PhysicsEngineV2, Scene, ShadowGenerator, UniversalCamera } from "@babylonjs/core";
import type { ArenaDef, World } from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import type { Settings } from "../settings/settings.js";
import type { Materials } from "./materials.js";

export type FightState = "fighting" | "won" | "lost";

export interface Fight {
  state: FightState;
  /** Seconds in the current state (since the fight started, or since it was decided). */
  stateTime: number;
}

/** Seconds a decided fight waits before showing the result and taking the leave key. */
const RESULT_DELAY = 1;
export const resultShown = (fight: Fight): boolean => fight.state !== "fighting" && fight.stateTime > RESULT_DELAY;

export interface BattleContext {
  world: World;
  scene: Scene;
  physics: PhysicsEngineV2;
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
  fight: Fight;
  /** Camera shake amplitude, decays over time. Add to it for impacts. */
  shake: number;
}
