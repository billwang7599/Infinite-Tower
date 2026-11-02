/** Overworld entities: the local player (LocalPlayer) is predicted, everything else is where the server says. */
import {
  defineComponent, type ActorSnap, type Character, type Entity, type Heading, type LevelLayout, type LevelMap,
  type NpcId, type Vec2, type World,
} from "@infinite-tower/shared";

/** In tiles. */
export const OverworldPos = defineComponent<Vec2>("OverworldPos");

export interface OverworldActorData {
  kind: ActorSnap["kind"] | "player" | "peer" | "pile" | "npc" | "trace";
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

export const Npc = defineComponent<{ id: NpcId }>("Npc");

export const Speech = defineComponent<{ text: string; remainingTime: number }>("Speech");

export interface OverworldState {
  world: World;
  player: Entity;
  /** null until the server's first `level`. */
  level: LevelLayout | null;
  next: LevelMap[];
  /** Quarter turns right from north. */
  cameraTurns: number;
  cameraPitchRad: number;
}
