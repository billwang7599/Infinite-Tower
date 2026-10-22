import type { Scene, PhysicsEngineV2, HavokPlugin, UniversalCamera, ShadowGenerator } from "@babylonjs/core";
import type { World } from "@infinite-tower/shared";
import type { Keyboard, Mouse } from "../core/input.js";
import type { Materials } from "./materials.js";

export type FightState = "fighting" | "won" | "lost";

/** Everything systems need besides the World. Created once in main.ts. */
export interface GameContext {
  world: World;
  scene: Scene;
  physics: PhysicsEngineV2;
  havok: HavokPlugin;
  camera: UniversalCamera;
  keyboard: Keyboard;
  mouse: Mouse;
  materials: Materials;
  shadows: ShadowGenerator;
  /**
   * Orbit angles of the camera (radians), from mouse / arrow keys. Yaw is also the aim direction:
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
