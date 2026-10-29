/** One player's overworld: their own ECS world, with the level's actors and the player walking it. */
import { World, type EnemyId, type Entity, type System, type Vec2 } from "@infinite-tower/shared";
import type { LevelDef, SpawnDef } from "../world/level.js";
import { chaseSystem } from "./behaviors/chase.js";
import { moveSystem } from "./behaviors/move.js";
import { touchSystem } from "./behaviors/touch.js";
import { wanderSystem } from "./behaviors/wander.js";
import { OverworldPlayer, OverworldPos, type OverworldPlayerData } from "./components.js";
import type { OverworldContext } from "./context.js";
import { overworldPlayerSystem, queueInput } from "./player.js";
import { Spawner } from "./spawner.js";

export class Overworld implements OverworldContext {
  readonly world = new World();
  readonly player: Entity;
  readonly rng = Math.random;
  private current: LevelDef | null = null;
  private spawner: Spawner | null = null;
  private readonly systems: System[];
  /** Highest input seq accepted. */
  private lastSeq = 0;
  private encounterStarted = false;

  constructor(private readonly onEncounter: (source: Entity | null, enemy: EnemyId) => void) {
    this.systems = [
      overworldPlayerSystem(this), chaseSystem(), wanderSystem(this), moveSystem(this), touchSystem(this),
      (world, dt) => this.spawner?.system(world, dt),
    ];
    this.player = this.world.spawn();
    this.world.add(this.player, OverworldPos, { x: 0, z: 0 });
    this.world.add(this.player, OverworldPlayer, { queue: [], credits: 0, ack: 0, grassDist: 0, safeTime: 0, pace: 1 });
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

  spawnOf(actor: Entity): SpawnDef | undefined {
    return this.spawner?.spawnOf(actor);
  }

  /** Clears the old level's actors, places the player at the spawn, spawns the new actors. */
  enter(level: LevelDef): void {
    this.spawner?.clear();
    this.current = level;
    this.place(level.spawn);
    this.spawner = new Spawner(this.world, level.spawns);
  }

  /** Runs every overworld system once, stopping early if one starts a battle. */
  step(dt: number): void {
    this.encounterStarted = false;
    for (const system of this.systems) {
      system(this.world, dt);
      if (this.encounterStarted) break;
    }
    this.world.flush();
  }

  /** Older or repeated inputs are ignored. */
  input(seq: number, moveX: number, moveZ: number): void {
    if (seq <= this.lastSeq) return;
    this.lastSeq = seq;
    queueInput(this.playerData(), { seq, moveX, moveZ });
  }

  /** After a battle or teleport: no stale inputs or encounter progress. */
  resetWalk(safeTime: number): void {
    const walk = this.playerData();
    walk.queue.length = 0;
    walk.credits = 0;
    walk.grassDist = 0;
    walk.safeTime = safeTime;
  }

  place(at: Vec2): void {
    const pos = this.world.require(this.player, OverworldPos);
    pos.x = at.x;
    pos.z = at.z;
  }

  playerPos(): Vec2 {
    const pos = this.world.require(this.player, OverworldPos);
    return { x: pos.x, z: pos.z };
  }

  playerData(): OverworldPlayerData {
    return this.world.require(this.player, OverworldPlayer);
  }
}
