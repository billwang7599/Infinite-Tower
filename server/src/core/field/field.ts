/**
 * One player's field: their own ECS world (single-player for now) with the level's actors and the player walking
 * it, run by the field systems. The session owns it and is told through `onEncounter` when a battle should start.
 */
import { World, type Entity, type System, type Vec2 } from "@infinite-tower/shared";
import type { EnemyId } from "../content/enemies.js";
import type { LevelDef } from "../levels/level.js";
import { chaseSystem } from "./behaviors/chase.js";
import { moveSystem } from "./behaviors/move.js";
import { touchSystem } from "./behaviors/touch.js";
import { wanderSystem } from "./behaviors/wander.js";
import { FieldPlayer, FieldPos, type FieldPlayerData } from "./components.js";
import type { FieldContext } from "./context.js";
import { fieldPlayerSystem, queueInput } from "./player.js";
import { Spawner } from "./spawner.js";

export class Field implements FieldContext {
  readonly world = new World();
  readonly player: Entity;
  readonly rng = Math.random;
  private current: LevelDef | null = null;
  private spawner: Spawner | null = null;
  private readonly systems: System[];
  /** Highest input seq accepted (older or repeated ones are ignored). */
  private lastSeq = 0;
  private encounterStarted = false;

  constructor(private readonly onEncounter: (source: Entity | null, enemy: EnemyId) => void) {
    this.systems = [
      fieldPlayerSystem(this), chaseSystem(), wanderSystem(this), moveSystem(this), touchSystem(this),
      (world, dt) => this.spawner?.system(world, dt),
    ];
    this.player = this.world.spawn();
    this.world.add(this.player, FieldPos, { x: 0, z: 0 });
    this.world.add(this.player, FieldPlayer, { queue: [], credits: 0, ack: 0, grassDist: 0, safeTime: 0 });
  }

  get level(): LevelDef {
    if (!this.current) throw new Error("not in a level yet");
    return this.current;
  }
  /** false until the player has a character and has been put in a level. */
  get hasLevel(): boolean { return this.current !== null; }

  startEncounter(source: Entity | null, enemy: EnemyId): void {
    this.encounterStarted = true;
    this.onEncounter(source, enemy);
  }

  /** Load a level: clear the old one's actors, place the player at its spawn, spawn the new actors. */
  enter(level: LevelDef): void {
    this.spawner?.clear();
    this.current = level;
    this.place(level.spawn);
    this.spawner = new Spawner(this.world, level.spawns);
  }

  /** Runs every field system once, stopping early if one starts a battle. */
  step(dt: number): void {
    this.encounterStarted = false;
    for (const system of this.systems) {
      system(this.world, dt);
      if (this.encounterStarted) break;
    }
    this.world.flush();
  }

  /** A walking input (the client sends one per tick while moving). Older or repeated ones are ignored. */
  input(seq: number, moveX: number, moveZ: number): void {
    if (seq <= this.lastSeq) return;
    this.lastSeq = seq;
    queueInput(this.playerData(), { seq, moveX, moveZ });
  }

  /** Reset walking state after a battle or teleport: no stale inputs or encounter progress. */
  resetWalk(safeTime: number): void {
    const fp = this.playerData();
    fp.queue.length = 0;
    fp.credits = 0;
    fp.grassDist = 0;
    fp.safeTime = safeTime;
  }

  place(at: Vec2): void {
    const pos = this.world.require(this.player, FieldPos);
    pos.x = at.x;
    pos.z = at.z;
  }

  playerPos(): Vec2 {
    const pos = this.world.require(this.player, FieldPos);
    return { x: pos.x, z: pos.z };
  }

  playerData(): FieldPlayerData {
    return this.world.require(this.player, FieldPlayer);
  }
}
