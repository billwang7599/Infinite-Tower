/** What a fight's systems share besides the ECS world: its physics, its arena, what happened and how it stands. */
import type { Entity, World } from "../../core/ecs.js";
import type { Vec3 } from "../../core/math.js";
import type { ItemId } from "../../items/items.js";
import type { AttackKind } from "../../weapons/weapons.js";
import type { Form, SkillElement } from "../../skills/skill.js";
import type { ArenaDef } from "../../world/arena.js";
import type { TeamId } from "../components.js";
import type { ArenaPhysics } from "./physics/arena-physics.js";

export type FightState = "fighting" | "won" | "lost";

export interface FightOutcome {
  state: FightState;
  /** Seconds in the current state (since the fight started, or since it was decided). */
  stateTime: number;
}

/** Something that happened this step that the client shows (the screen shakes) but the fight doesn't need again. */
export type FightEvent =
  | { type: "hit"; by: Entity; target: Entity; team: TeamId; damage: number; weapon: boolean }
  /** A charging enemy slammed into the wall. */
  | { type: "slam"; enemy: Entity }
  | { type: "block"; by: Entity; target: Entity; broken?: boolean }
  | { type: "parry"; by: Entity; target: Entity; attack: AttackKind }
  | { type: "feint"; by: Entity }
  | { type: "guardBreak"; by: Entity; target: Entity; result: "grabbed" | "teched" | "broken" }
  | { type: "kick"; by: Entity; target: Entity; result: "staggered" | "shoved" | "nothing" }
  | { type: "posture"; by: Entity; target: Entity; what: "broken" | "deathblow" | "mikiri" | "jumpKick" | "zanshin" }
  | { type: "strike"; by: Entity; target: Entity; what: "clash" | "disarm" | "beat" | "offLine" | "impale" | "pickup" }
  | { type: "skill"; form: Form; elements: readonly SkillElement[]; at: Vec3; radiusM?: number }
  | { type: "pageWritten"; player: Entity; page: number }
  | { type: "used"; player: Entity; item: ItemId; brokeThrough: boolean };

export interface FightContext {
  world: World;
  physics: ArenaPhysics;
  arena: ArenaDef;
  enemies: readonly Entity[];
  /** This step's; emptied as each step starts. */
  events: FightEvent[];
  outcome: FightOutcome;
}
