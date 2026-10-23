import type { Scene, PhysicsEngineV2, HavokPlugin, UniversalCamera, ShadowGenerator } from "@babylonjs/core";
import type { World } from "@infinite-tower/shared";
import type { Keyboard } from "../core/input.js";
import type { Mouse } from "../core/mouse.js";
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
   * Orbit angles of the camera (radians), from the mouse or H/L (or arrows). Yaw is also the aim direction:
   * forward = (sin yaw, cos yaw). Movement is camera-relative.
   * `lock`: lock-on, the camera turns itself to keep the enemy in front (so attacks aim at it).
   */
  view: { yaw: number; pitch: number; lock: boolean };
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
