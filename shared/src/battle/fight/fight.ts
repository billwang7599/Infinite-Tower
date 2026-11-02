/**
 * One arena fight, whole: its own ECS world and physics world, stepped at a fixed rate by the players' inputs.
 * Nothing lives outside it and nothing in it is random but its own seeds, so the same setup and inputs give the
 * same fight on any machine. The server runs it and decides it; each client runs its own copy
 * (client/src/modes/battle/).
 */
import { World, type Entity, type System } from "../../core/ecs.js";
import { approach } from "../../core/math.js";
import { FIXED_DT } from "../../core/time.js";
import type { ArenaDef } from "../../world/arena.js";
import { Body, Enemy, Health, Player, SkillObject } from "../components.js";
import { copyInput, PlayerInput, type PlayerInputData } from "../input.js";
import { PLAYER } from "../player.js";
import { combatSystem } from "./combat.js";
import type { FightContext, FightEvent, FightOutcome } from "./context.js";
import { enemyBrainSystem } from "./behaviors/brain.js";
import { chargeAttackSystem } from "./behaviors/charge.js";
import { lungeAttackSystem } from "./behaviors/lunge.js";
import { pounceAttackSystem } from "./behaviors/pounce.js";
import { sidestepSystem } from "./behaviors/sidestep.js";
import { skillAttackSystem } from "./behaviors/skill.js";
import { slamAttackSystem } from "./behaviors/slam.js";
import { weaponAttackSystem } from "./behaviors/weapon.js";
import { outcomeSystem } from "./outcome.js";
import { ArenaPhysics } from "./physics/arena-physics.js";
import { moveSystem } from "./physics/move.js";
import { playerControllerSystem } from "./player/controller.js";
import { useSystem } from "./player/use.js";
import { skillSystem } from "./skills/cast.js";
import { windUpSystem } from "./skills/skilled.js";
import { modsOf, regenSystem, statusSystem } from "./statuses.js";
import { spawnEnemy, spawnPlayer, type FightSetup, type PlayerSetup } from "./setup.js";
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
      const v = body.vel, m = enemy.move, speed = m.speed * modsOf(world, e).moveFactor;
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
  private readonly seated: Entity[];
  readonly enemies: readonly Entity[];
  readonly duel: boolean;
  readonly yieldAt: number;
  /** What an input's `locked` indexes: the enemies, or in a duel the players. */
  readonly targets: readonly Entity[];
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
    this.duel = setup.duel ?? false;
    this.seated = setup.players.map((p, i) => spawnPlayer(this.world, this.physics, p, this.duel ? i : 0));
    this.enemies = setup.enemies.map((e) => spawnEnemy(this.world, this.physics, e));
    this.targets = this.duel ? this.players : this.enemies;
    this.yieldAt = setup.yieldAt ?? 0;
    for (const e of [...this.seated, ...this.enemies]) this.setFloor(e);
    const ctx: FightContext = {
      world: this.world, physics: this.physics, arena: this.arena, enemies: this.enemies, events: this.events,
      outcome: this.outcome,
    };
    this.systems = [
      playerControllerSystem(this.targets, this.events),
      enemyBrainSystem(), chargeAttackSystem(ctx), lungeAttackSystem(), pounceAttackSystem(),
      slamAttackSystem(ctx), weaponAttackSystem(this.events),
      skillAttackSystem(),
      weaponSystem(),
      windUpSystem(), sidestepSystem(ctx), enemyMotorSystem(),
      moveSystem(this.physics),
      playerGroundSystem(this.physics), combatSystem(this.events),
      statusSystem(),
      regenSystem(),
      skillSystem(ctx), useSystem(ctx),
      outcomeSystem(this.outcome, this.duel),
    ];
  }

  /** Setup order, then joining order: the order `step` takes their inputs in. */
  get players(): readonly Entity[] {
    return this.seated;
  }

  join(setup: PlayerSetup): Entity {
    const e = spawnPlayer(this.world, this.physics, setup);
    this.setFloor(e);
    this.seated.push(e);
    return e;
  }

  private setFloor(e: Entity): void {
    const health = this.world.require(e, Health);
    health.floor = health.max * this.yieldAt;
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

  /** Mid-fight they're down as if dead, for good (outcome.ts says what that costs). */
  leave(player: Entity): void {
    this.world.require(player, Player).leftArena = true;
    if (this.outcome.state === "fighting") this.world.require(player, Health).hp = 0;
  }

  /** Destroys the entities (their remove hooks run) and frees the physics world. */
  dispose(): void {
    for (const e of [...this.players, ...this.enemies]) this.world.destroy(e);
    for (const [e] of this.world.query(SkillObject)) this.world.destroy(e);
    this.world.flush();
    this.physics.free();
  }
}
