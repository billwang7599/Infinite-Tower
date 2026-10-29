/** One level's overworld, shared by every player on it: their walkers and the level's actors, in one ECS world. */
import { World, type Character, type EnemyId, type Entity, type System, type Vec2 } from "@infinite-tower/shared";
import type { LevelDef, SpawnDef } from "../world/level.js";
import { chaseSystem } from "./behaviors/chase.js";
import { moveSystem } from "./behaviors/move.js";
import { touchSystem } from "./behaviors/touch.js";
import { wanderSystem } from "./behaviors/wander.js";
import { OverworldPlayer, OverworldPos, type OverworldPlayerData } from "./components.js";
import type { OverworldContext } from "./context.js";
import { newWalk, overworldPlayerSystem, queueInput } from "./player.js";
import { Spawner } from "./spawner.js";

type OnEncounter = (source: Entity | null, enemy: EnemyId, spawn: SpawnDef | undefined) => void;

export class Overworld implements OverworldContext {
  readonly world = new World();
  readonly rng = Math.random;
  private readonly spawner: Spawner;
  private readonly systems: System[];
  private readonly onEncounter = new Map<Entity, OnEncounter>();

  constructor(readonly level: LevelDef) {
    this.systems = [
      overworldPlayerSystem(this), chaseSystem(), wanderSystem(this), moveSystem(this), touchSystem(this),
      (world, dt) => this.spawner.system(world, dt),
    ];
    this.spawner = new Spawner(this.world, level.spawns);
  }

  join(character: Character, onEncounter: OnEncounter): Entity {
    const player = this.world.spawn();
    this.world.add(player, OverworldPos, { ...this.level.spawn });
    this.world.add(player, OverworldPlayer, newWalk(character));
    this.onEncounter.set(player, onEncounter);
    return player;
  }

  leave(player: Entity): void {
    this.onEncounter.delete(player);
    this.world.destroy(player);
    this.world.flush();
  }

  /** A touched `source` leaves the overworld for the fight; `spawn` defaults to the one it came from. */
  startEncounter(player: Entity, source: Entity | null, enemy: EnemyId, spawn?: SpawnDef): void {
    if (!this.enterFight(player)) return;
    const from = source === null ? spawn : this.spawner.spawnOf(source);
    if (source !== null) this.spawner.take(source);
    this.onEncounter.get(player)?.(source, enemy, from);
  }

  get empty(): boolean {
    return this.onEncounter.size === 0;
  }

  enterFight(player: Entity): boolean {
    const walk = this.playerData(player);
    if (walk.fighting) return false;
    walk.fighting = true;
    walk.queue.length = 0;
    walk.vx = walk.vz = 0;
    return true;
  }

  fightDecided(actor: Entity): void {
    this.spawner.release(actor);
  }

  endFight(player: Entity, safeTime: number): void {
    const walk = this.playerData(player);
    walk.fighting = false;
    walk.queue.length = 0;
    walk.credits = 0;
    walk.grassDist = 0;
    walk.safeTime = safeTime;
  }

  step(dt: number): void {
    for (const system of this.systems) system(this.world, dt);
    this.world.flush();
  }

  /** Older or repeated inputs are ignored. */
  input(player: Entity, seq: number, moveX: number, moveZ: number): void {
    const walk = this.playerData(player);
    if (seq <= walk.lastSeq) return;
    walk.lastSeq = seq;
    queueInput(walk, { seq, moveX, moveZ });
  }

  place(player: Entity, at: Vec2): void {
    const pos = this.world.require(player, OverworldPos);
    pos.x = at.x;
    pos.z = at.z;
  }

  playerPos(player: Entity): Vec2 {
    const pos = this.world.require(player, OverworldPos);
    return { x: pos.x, z: pos.z };
  }

  playerData(player: Entity): OverworldPlayerData {
    return this.world.require(player, OverworldPlayer);
  }
}
