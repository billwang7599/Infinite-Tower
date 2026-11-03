/** Overworld entities on the server. The client sees them through `state` (ActorSnap). */
import {
  defineComponent, type ActorSnap, type Bag, type Character, type Heading, type Vec2,
} from "@infinite-tower/shared";

export const OverworldPos = defineComponent<Vec2>("OverworldPos");

/** Anything drawn on the overworld. Behaviors write the velocity; the move system applies it. */
export interface OverworldActorData {
  kind: ActorSnap["kind"];
  vx: number;
  vz: number;
  facing: 1 | -1;
  /** A higher-priority behavior (chasing, say) is steering: lower ones (wandering) hold off. */
  busy: boolean;
  /** Shown as "!" on the client. */
  alert: boolean;
}
export const OverworldActor = defineComponent<OverworldActorData>("OverworldActor");

export interface QueuedInput { seq: number; moveX: number; moveZ: number }

export interface OverworldPlayerData {
  character: Character;
  queue: QueuedInput[];
  lastSeq: number;
  /** Inputs the player may still simulate: +1 per tick, capped, so a client can't move faster by sending more. */
  credits: number;
  /** The last input simulated. */
  ack: number;
  /** Tiles walked in tall grass since the last encounter roll. */
  grassDist: number;
  /** Seconds left without encounters. */
  safeTime: number;
  /** Share of normal walking speed, from the bag's weight. */
  pace: number;
  vx: number;
  vz: number;
  heading: Heading;
  /** In a battle: still here for the others to see, but out of the overworld's play. */
  fighting: boolean;
}
export const OverworldPlayer = defineComponent<OverworldPlayerData>("OverworldPlayer");

/** `items` is replaced, never changed in place: sessions spot a change by reference. */
export interface PileData {
  items: Bag;
  vanishAtMs: number;
}
export const Pile = defineComponent<PileData>("Pile");

export const SummoningPad = defineComponent<{ region: string }>("SummoningPad");
