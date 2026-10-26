/** What a fight's systems share besides the ECS world: its physics, its arena, what happened and how it stands. */
import type { Entity, World } from "../../core/ecs.js";
import type { TeamId } from "../components.js";
import type { ArenaDef } from "../defs.js";
import type { ArenaPhysics } from "./physics/arena-physics.js";

export type FightState = "fighting" | "won" | "lost";

export interface FightOutcome {
  state: FightState;
  /** Seconds in the current state (since the fight started, or since it was decided). */
  stateTime: number;
}

/** Something that happened this step that the client shows (the screen shakes) but the fight doesn't need again. */
export type FightEvent =
  | { type: "hit"; target: Entity; team: TeamId; damage: number }
  /** A charging enemy slammed into the wall. */
  | { type: "slam"; enemy: Entity };

export interface FightContext {
  world: World;
  physics: ArenaPhysics;
  arena: ArenaDef;
  /** This step's; emptied as each step starts. */
  events: FightEvent[];
  outcome: FightOutcome;
}
