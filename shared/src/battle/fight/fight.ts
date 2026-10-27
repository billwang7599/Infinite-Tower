/**
 * One arena fight, whole: its own ECS world and physics world, stepped at a fixed rate by the players' inputs.
 * Nothing in it is random, and nothing lives outside it, so the same setup and inputs always give the same fight,
 * on any machine (Rapier's deterministic build), and a server can run many side by side. The server runs it and
 * decides it (server/src/core/battle/); each client runs its own copy at once with its inputs (that's what it
 * draws), checks it against the server's hash (`hash`) and, when they differ, loads the server's state (`load`) and
 * replays its inputs since (client/src/battle/sync.ts).
 */
import { World, type Entity, type System } from "../../core/ecs.js";
import { FIXED_DT } from "../../core/time.js";
import { Health } from "../components.js";
import { copyInput, PlayerInput, type PlayerInputData } from "../input.js";
import type { ArenaDef } from "../defs.js";
import { combatSystem } from "./combat.js";
import type { FightContext, FightEvent, FightOutcome } from "./context.js";
import { enemyBrainSystem } from "./enemies/brain.js";
import { chargeAttackSystem } from "./enemies/charge.js";
import { lungeAttackSystem } from "./enemies/lunge.js";
import { enemyMotorSystem } from "./enemies/motor.js";
import { hashFight } from "./hash.js";
import { outcomeSystem } from "./outcome.js";
import { ArenaPhysics } from "./physics/arena-physics.js";
import { moveSystem } from "./physics/move.js";
import { playerControllerSystem } from "./player/controller.js";
import { playerGroundSystem } from "./player/ground.js";
import { spawnEnemy, spawnPlayer, type FightSetup } from "./setup.js";
import { loadFight, saveFight, type FightSnapshot } from "./state.js";

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
  /** Steps run so far: the number of the last one (steps count from 1). */
  steps = 0;
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
      if (input) Object.assign(this.world.require(e, PlayerInput), copyInput(input));
    });
    for (const system of this.systems) system(this.world, Fight.STEP_SECONDS);
    this.world.flush();
    this.steps++;
  }

  /** The whole state, as plain JSON (state.ts). */
  save(): FightSnapshot {
    return saveFight(this);
  }

  /** Makes this fight (built from the same setup) exactly as `snapshot` says, step count and colliders included. */
  load(snapshot: FightSnapshot): void {
    loadFight(this, snapshot);
  }

  /** A fingerprint of the state, rounded as hash.ts says: the same on two machines whose fights agree. */
  hash(): number {
    return hashFight(this);
  }

  /** `player` is gone (disconnected): out of the fight for good, down as if dead. outcome.ts says what that costs. */
  leave(player: Entity): void {
    this.world.require(player, Health).hp = 0;
  }

  /** Ends the fight: its entities are destroyed (their remove hooks run) and the physics world is freed. */
  dispose(): void {
    for (const e of [...this.players, ...this.enemies]) this.world.destroy(e);
    this.world.flush();
    this.physics.free();
  }
}
