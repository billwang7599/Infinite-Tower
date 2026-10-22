import type { Scene, PhysicsEngineV2, HavokPlugin, UniversalCamera } from "@babylonjs/core";
import type { World } from "@infinite-tower/shared";
import type { Keyboard } from "./input.js";
import type { Materials } from "./materials.js";

/** Everything systems need besides the World. Created once in main.ts. */
export interface GameContext {
  world: World;
  scene: Scene;
  physics: PhysicsEngineV2;
  havok: HavokPlugin;
  camera: UniversalCamera;
  keyboard: Keyboard;
  materials: Materials;
  seed: number;
}

/** Havok collision filter groups (bit masks). */
export const Layer = {
  /** One-way: players jump up through these and land on top. */
  Platform: 1 << 0,
  Player: 1 << 1,
  /** Always solid. */
  Wall: 1 << 2,
} as const;
