/** One level's overworld, shared by every player on it: their walkers and the level's actors, in one ECS world. */
import {
  distXZ, World, type Bag, type Character, type EnemyId, type Entity, type ItemCounts, type System, type Vec2,
} from "@infinite-tower/shared";
import type { LevelDef, SpawnDef } from "../world/level.js";
import { chaseSystem } from "./behaviors/chase.js";
import { moveSystem } from "./behaviors/move.js";
import { touchSystem } from "./behaviors/touch.js";
import { wanderSystem } from "./behaviors/wander.js";
import { OverworldPlayer, OverworldPos, Pile, type OverworldPlayerData } from "./components.js";
import type { OverworldContext } from "./context.js";
import { packPile, PILE_LIFETIME_MS, pileSystem } from "./piles.js";
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
      (world, dt) => this.spawner.system(world, dt), pileSystem,
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

  dropPile(at: Vec2, items: ItemCounts): Entity | null {
    const pile = this.holdPile(items);
    if (pile !== null) this.landPile(pile, at);
    return pile;
  }

  /** Off the map and not timed until it lands: an arena's drops. */
  holdPile(items: ItemCounts): Entity | null {
    if (!Object.values(items).some((count) => count > 0)) return null;
    const pile = this.world.spawn();
    this.world.add(pile, Pile, { items: packPile(items), vanishAtMs: Infinity });
    return pile;
  }

  /** Its PILE_LIFETIME_MS starts now. */
  landPile(pile: Entity, at: Vec2): void {
    this.world.add(pile, OverworldPos, { x: at.x, z: at.z });
    this.world.require(pile, Pile).vanishAtMs = Date.now() + PILE_LIFETIME_MS;
  }

  nearestPile(at: Vec2, rangeTiles: number): Entity | null {
    let nearest: { pile: Entity; dist: number } | null = null;
    for (const [pile, , pos] of this.world.query(Pile, OverworldPos)) {
      const dist = distXZ(at, pos);
      if (dist <= rangeTiles && (!nearest || dist < nearest.dist)) nearest = { pile, dist };
    }
    return nearest?.pile ?? null;
  }

  pileItems(pile: Entity): Bag | null {
    return this.world.isAlive(pile) ? this.world.get(pile, Pile)?.items ?? null : null;
  }

  setPileItems(pile: Entity, items: Bag): void {
    if (items.items.length > 0) {
      this.world.require(pile, Pile).items = items;
      return;
    }
    this.world.destroy(pile);
    this.world.flush();
  }
}
