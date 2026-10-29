/**
 * Spawns a level's actors and replaces defeated ones after `respawnTime`, away from players if they're near. An actor
 * taken into a fight is gone for everyone, and its time to come back starts only once that fight is over.
 */
import { distXZ, type Entity, type System, type Vec2, type World } from "@infinite-tower/shared";
import { ENEMIES } from "../enemies/index.js";
import type { SpawnDef } from "../world/level.js";
import { OverworldPlayer, OverworldPos } from "./components.js";
import { spawnActor } from "./parts.js";

interface Slot {
  def: SpawnDef;
  entity: Entity | null;
  /** Seconds until a defeated actor comes back. */
  timeToRespawn: number;
  takenBy: Entity | null;
}

/** Don't pop in closer to a player than this. */
const MIN_PLAYER_DIST = 6;

export class Spawner {
  private readonly slots: Slot[];

  constructor(private readonly world: World, spawns: SpawnDef[]) {
    this.slots = spawns.map((def) => ({ def, entity: this.spawn(def), timeToRespawn: 0, takenBy: null }));
  }

  readonly system: System = (world, dt) => {
    for (const slot of this.slots) {
      if (slot.entity !== null) {
        if (world.isAlive(slot.entity)) continue;
        slot.entity = null;
        slot.timeToRespawn = slot.def.respawnTime;
      }
      if (slot.takenBy !== null) continue;
      slot.timeToRespawn -= dt;
      if (slot.timeToRespawn <= 0) slot.entity = this.spawn(slot.def);
    }
  };

  spawnOf(e: Entity): SpawnDef | undefined {
    return this.slots.find((s) => s.entity === e)?.def;
  }

  take(actor: Entity, player: Entity): void {
    const slot = this.slots.find((s) => s.entity === actor);
    this.world.destroy(actor);
    if (slot) slot.takenBy = player;
  }

  release(player: Entity): void {
    for (const slot of this.slots) if (slot.takenBy === player) slot.takenBy = null;
  }

  private spawn(def: SpawnDef): Entity {
    return spawnActor(this.world, def.enemy, this.placeAway(def.at), ENEMIES[def.enemy].overworld());
  }

  private placeAway(at: Vec2): Vec2 {
    for (const [, , pos] of this.world.query(OverworldPlayer, OverworldPos)) {
      if (distXZ(pos, at) < MIN_PLAYER_DIST) return { x: -at.x, z: at.z };
    }
    return at;
  }
}
