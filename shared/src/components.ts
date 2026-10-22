/**
 * Gameplay components shared by client and (future) server.
 * Plain data only. Engine handles (meshes, physics bodies) live in client/src/components.ts.
 */
import { defineComponent } from "./ecs.js";

export interface Vec3 { x: number; y: number; z: number }

/** What a player wants to do this tick. Filled by local input now, by network messages later. */
export interface PlayerInputData {
  moveX: number; // -1..1
  moveZ: number; // -1..1
  jump: boolean; // held this tick
}
export const PlayerInput = defineComponent<PlayerInputData>("PlayerInput");

export interface PlayerData {
  name: string;
  /** Highest floor reached. */
  bestFloor: number;
  spawnPoint: Vec3;
  grounded: boolean;
  /** Seconds since last on ground (coyote time). */
  airTime: number;
  /** Seconds left on buffered jump press. */
  jumpBuffer: number;
  jumpHeld: boolean;
}
export const Player = defineComponent<PlayerData>("Player");

/** Marks the player controlled on this machine. */
export const LocalPlayer = defineComponent<true>("LocalPlayer");

/** A platform belonging to a generated tower floor. */
export interface PlatformData { floor: number }
export const Platform = defineComponent<PlatformData>("Platform");
