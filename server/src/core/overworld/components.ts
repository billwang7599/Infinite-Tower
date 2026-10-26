/** Overworld entities on the server. The client only sees them through `state` snapshots (ActorSnap). */
import { defineComponent, type ActorSnap, type Vec2 } from "@infinite-tower/shared";

export const OverworldPos = defineComponent<Vec2>("OverworldPos");

/** Anything drawn on the overworld. Behaviors write the velocity; the move system applies it. */
export interface OverworldActorData {
  /** Which client prefab draws it. */
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
  /** Inputs received but not yet simulated. */
  queue: QueuedInput[];
  /** Inputs the player may still simulate: +1 per tick, capped, so a client can't move faster by sending more. */
  credits: number;
  /** Seq of the last input simulated. */
  ack: number;
  /** Tiles walked in tall grass since the last encounter roll. */
  grassDist: number;
  /** Seconds left without encounters. */
  safeTime: number;
  /** Share of normal walking speed: the session sets it from the bag's weight (`walkPace`). */
  pace: number;
}
export const OverworldPlayer = defineComponent<OverworldPlayerData>("OverworldPlayer");
