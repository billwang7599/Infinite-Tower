/**
 * One arena fight, whole: its own ECS world and physics world, stepped at a fixed rate by the players' inputs.
 * Nothing lives outside it and nothing in it is random but its own seeds, so the same setup and inputs give the
 * same fight on any machine. The server runs it and decides it; each client runs its own copy
 * (client/src/modes/battle/).
 */
import { World, type Entity, type System } from "../../core/ecs.js";
import { approach } from "../../core/math.js";
import { FIXED_DT } from "../../core/time.js";
import { Body, Enemy, Health, Player, SpellObject, Statuses } from "../components.js";
import { copyInput, PlayerInput, type PlayerInputData } from "../input.js";
import type { ArenaDef } from "../defs.js";
import { PLAYER } from "../player.js";
import { combatSystem } from "./combat.js";
import type { FightContext, FightEvent, FightOutcome } from "./context.js";
import { enemyBrainSystem } from "./enemies/brain.js";
import { chargeAttackSystem } from "./enemies/charge.js";
import { lungeAttackSystem } from "./enemies/lunge.js";
import { sidestepSystem } from "./enemies/sidestep.js";
import { swordAttackSystem } from "./enemies/sword.js";
import { outcomeSystem } from "./outcome.js";
import { ArenaPhysics } from "./physics/arena-physics.js";
import { moveSystem } from "./physics/move.js";
import { playerControllerSystem } from "./player/controller.js";
import { spellSystem } from "./spells/cast.js";
import { statusMoveFactor, statusSystem } from "./spells/statuses.js";
import { spawnEnemy, spawnPlayer, type FightSetup } from "./setup.js";
import { hashFight, loadFight, saveFight, type FightSnapshot } from "./state.js";
import { weaponSystem } from "./weapons/swing.js";

/** How far below the feet a ray still finds the floor. */
const GROUND_PROBE = 0.08;
/** Rising faster than this (m/s), a player isn't on the ground, whatever is under their feet. */
const MAX_GROUNDED_RISE = 0.5;
const RAY_SPREAD = PLAYER.radius * 0.7;
const RAY_OFFSETS = [[0, 0], [RAY_SPREAD, 0], [-RAY_SPREAD, 0], [0, RAY_SPREAD], [0, -RAY_SPREAD]] as const;

/** After each physics step: a few short rays down from the feet decide `grounded`. */
function playerGroundSystem(physics: ArenaPhysics): System {
  return (world, dt) => {
    for (const [, player, body] of world.query(Player, Body)) {
      const p = body.pos, reach = body.centerHeight + GROUND_PROBE;
      const grounded = body.vel.y <= MAX_GROUNDED_RISE
        && RAY_OFFSETS.some(([ox, oz]) => physics.floorBelow(p.x + ox, p.y, p.z + oz, reach) !== null);
      player.grounded = grounded;
      player.airTime = grounded ? 0 : player.airTime + dt;
    }
  };
}

/** Turns each enemy's wanted movement (Enemy.move) into velocity, after its behaviors and before the physics. */
function enemyMotorSystem(): System {
  return (world, dt) => {
    for (const [e, enemy, body] of world.query(Enemy, Body)) {
      const v = body.vel, m = enemy.move, speed = m.speed * statusMoveFactor(world.get(e, Statuses));
      if (m.halt) v.x = v.z = 0;
      v.x = approach(v.x, m.dirX * speed, m.accel * dt);
      v.z = approach(v.z, m.dirZ * speed, m.accel * dt);
    }
  };
}

export class Fight {
  static readonly STEP_SECONDS = FIXED_DT;

  readonly world = new World();
  readonly physics: ArenaPhysics;
  readonly arena: ArenaDef;
  /** In the order of the setup; `step` takes their inputs in the same order. */
  readonly players: readonly Entity[];
  readonly enemies: readonly Entity[];
  readonly outcome: FightOutcome = { state: "fighting", stateTime: 0 };
  /** What happened in the last step. */
  readonly events: FightEvent[] = [];
  /** Steps run so far: the number of the last one (steps count from 1). */
  steps = 0;
  /** In the order that is the game's contract. */
  private readonly systems: System[];

  /** Needs initPhysics() to have finished. */
  constructor(setup: FightSetup) {
    this.arena = { ...setup.arena };
    this.physics = new ArenaPhysics(this.arena.radius);
    this.players = setup.players.map((p) => spawnPlayer(this.world, this.physics, p));
    this.enemies = setup.enemies.map((e) => spawnEnemy(this.world, this.physics, e));
    const ctx: FightContext = {
      world: this.world, physics: this.physics, arena: this.arena, enemies: this.enemies, events: this.events,
      outcome: this.outcome,
    };
    this.systems = [
      playerControllerSystem(),
      enemyBrainSystem(), chargeAttackSystem(ctx), lungeAttackSystem(), swordAttackSystem(), weaponSystem(),
      sidestepSystem(ctx), enemyMotorSystem(),
      moveSystem(this.physics),
      playerGroundSystem(this.physics), combatSystem(this.events), statusSystem(), spellSystem(ctx),
      outcomeSystem(this.outcome),
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

  save(): FightSnapshot {
    return saveFight(this);
  }

  /** Makes this fight (built from the same setup) exactly as `snapshot` says. */
  load(snapshot: FightSnapshot): void {
    loadFight(this, snapshot);
  }

  /** The same on two machines whose fights agree. */
  hash(): number {
    return hashFight(this);
  }

  /** `player` disconnected: down as if dead, for good (outcome.ts says what that costs). */
  leave(player: Entity): void {
    this.world.require(player, Health).hp = 0;
  }

  /** Destroys the entities (their remove hooks run) and frees the physics world. */
  dispose(): void {
    for (const e of [...this.players, ...this.enemies]) this.world.destroy(e);
    for (const [e] of this.world.query(SpellObject)) this.world.destroy(e);
    this.world.flush();
    this.physics.free();
  }
}
