/** Overworld entities: the local player (LocalPlayer) is predicted, everything else is where the server says. */
import {
  defineComponent, type ActorSnap, type Character, type Entity, type LevelLayout, type Vec2, type World,
} from "@infinite-tower/shared";
import type { Heading } from "./facing.js";

/** In tiles. */
export const OverworldPos = defineComponent<Vec2>("OverworldPos");

export interface OverworldActorData {
  kind: ActorSnap["kind"] | "player" | "peer";
  vx: number;
  vz: number;
  heading: Heading;
  /** Noticed you ("!"). */
  alert: boolean;
}
export const OverworldActor = defineComponent<OverworldActorData>("OverworldActor");

interface PeerData {
  character: Character;
  fighting: boolean;
}
export const Peer = defineComponent<PeerData>("Peer");

export interface OverworldState {
  world: World;
  player: Entity;
  /** null until the server's first `level`. */
  level: LevelLayout | null;
  /** Quarter turns right from north. */
  cameraTurns: number;
}
