/** Overworld entities: the local player (LocalPlayer) is predicted, everything else is where the server says. */
import {
  defineComponent, type ActorSnap, type Entity, type LevelLayout, type Vec2, type World,
} from "@infinite-tower/shared";
import type { Facing } from "./facing.js";

/** In tiles. */
export const OverworldPos = defineComponent<Vec2>("OverworldPos");

export interface OverworldActorData {
  kind: ActorSnap["kind"] | "player";
  vx: number;
  vz: number;
  facing: Facing;
  /** Noticed you ("!"). */
  alert: boolean;
}
export const OverworldActor = defineComponent<OverworldActorData>("OverworldActor");

export interface OverworldState {
  world: World;
  player: Entity;
  /** null until the server's first `level`. */
  level: LevelLayout | null;
}
