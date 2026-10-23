/** What arena systems need besides the World. Created by createBattle (battle.ts). */
import type { PhysicsEngineV2, Scene, ShadowGenerator, UniversalCamera } from "@babylonjs/core";
import type { ArenaDef, World } from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import type { Mouse } from "../core/mouse.js";
import type { Settings } from "../settings/settings.js";
import type { Materials } from "./materials.js";

export type FightState = "fighting" | "won" | "lost";

export interface BattleContext {
  world: World;
  scene: Scene;
  physics: PhysicsEngineV2;
  camera: UniversalCamera;
  keyboard: Keyboard;
  mouse: Mouse;
  settings: Settings;
  materials: Materials;
  shadows: ShadowGenerator;
  /** The current arena (from the server's encounter). */
  arena: ArenaDef;
  /**
   * Orbit angles of the camera (radians), from the mouse or the turn / tilt keys. Yaw is also the aim direction:
   * forward = (sin yaw, cos yaw). Movement is camera-relative.
   */
  view: { yaw: number; pitch: number };
  fight: { state: FightState; time: number };
  /** Camera shake amplitude, decays over time. Add to it for impacts. */
  shake: number;
}

/** Havok collision filter groups (bit masks). */
export const Layer = {
  Ground: 1 << 0,
  Player: 1 << 1,
  Wall: 1 << 2,
  Enemy: 1 << 3,
} as const;
