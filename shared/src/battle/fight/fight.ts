/**
 * One arena fight, whole: its own ECS world and physics world, stepped at a fixed rate by the players' inputs.
 * Nothing in it is random, and nothing lives outside it, so the same setup and inputs always give the same fight,
 * on any machine (Rapier's deterministic build), and a server can run many side by side. The client runs one for
 * now and draws from its state (client/src/battle/); later the server runs it and the client predicts.
 */
import { World, type Entity, type System } from "../../core/ecs.js";
import { FIXED_DT } from "../../core/time.js";
import { PlayerInput, type PlayerInputData } from "../input.js";
import type { ArenaDef } from "../defs.js";
import { combatSystem } from "./combat.js";
import type { FightContext, FightEvent, FightOutcome } from "./context.js";
import { enemyBrainSystem } from "./enemies/brain.js";
import { chargeAttackSystem } from "./enemies/charge.js";
import { lungeAttackSystem } from "./enemies/lunge.js";
import { enemyMotorSystem } from "./enemies/motor.js";
import { outcomeSystem } from "./outcome.js";
import { ArenaPhysics } from "./physics/arena-physics.js";
import { moveSystem } from "./physics/move.js";
import { playerControllerSystem } from "./player/controller.js";
import { playerGroundSystem } from "./player/ground.js";
import { spawnEnemy, spawnPlayer, type FightSetup } from "./setup.js";

export class Fight {
  /** Every step is this long. */
  static readonly STEP_SECONDS = FIXED_DT;

  /** The fighters' components. Whoever draws the fight may add their own to the same entities. */
  readonly world = new World();
  readonly physics: ArenaPhysics;
  readonly arena: ArenaDef;
  /** In the order of the setup; `step` takes their inputs in the same order. */
  readonly players: readonly Entity[];
  readonly enemies: readonly Entity[];
  readonly outcome: FightOutcome = { state: "fighting", stateTime: 0 };
  /** What happened in the last step (see FightEvent). */
  readonly events: FightEvent[] = [];
  /** The systems, in the order that is the game's contract. */
  private readonly systems: System[];

  /** Needs initPhysics() to have finished. */
  constructor(setup: FightSetup) {
    this.arena = { ...setup.arena };
    this.physics = new ArenaPhysics(this.arena.radius);
    this.players = setup.players.map((p) => spawnPlayer(this.world, this.physics, p));
    this.enemies = setup.enemies.map((e) => spawnEnemy(this.world, this.physics, e));
    const ctx: FightContext = {
      world: this.world, physics: this.physics, arena: this.arena, events: this.events, outcome: this.outcome,
    };
    this.systems = [
      playerControllerSystem(),
      enemyBrainSystem(), chargeAttackSystem(ctx), lungeAttackSystem(), enemyMotorSystem(),
      moveSystem(this.physics),
      playerGroundSystem(this.physics), combatSystem(this.events), outcomeSystem(this.outcome),
    ];
  }

  /** One step. `inputs[i]` is what `players[i]` does; a missing one keeps that player's last input. */
  step(inputs: readonly PlayerInputData[]): void {
    this.events.length = 0;
    this.players.forEach((e, i) => {
      const input = inputs[i];
      if (input) Object.assign(this.world.require(e, PlayerInput), input);
    });
    for (const system of this.systems) system(this.world, Fight.STEP_SECONDS);
    this.world.flush();
  }

  /** Ends the fight: its entities are destroyed (their remove hooks run) and the physics world is freed. */
  dispose(): void {
    for (const e of [...this.players, ...this.enemies]) this.world.destroy(e);
    this.world.flush();
    this.physics.free();
  }
}
