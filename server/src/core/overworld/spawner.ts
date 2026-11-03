/** Spawns the world's actors and replaces defeated ones after `respawnTime`, away from players if they're near. */
import { distXZ, type Entity, type System, type Vec2, type World } from "@infinite-tower/shared";
import { ENEMIES } from "../enemies/index.js";
import type { SpawnDef } from "../world/region.js";
import { OverworldPlayer, OverworldPos } from "./components.js";
import { spawnActor } from "./parts.js";

interface Slot {
  def: SpawnDef;
  entity: Entity | null;
  /** Seconds until a defeated actor comes back. */
  timeToRespawn: number;
  /** The actor, while the fight it was taken into is undecided (its fighters may come and go). */
  taken: Entity | null;
}

/** Don't pop in closer to a player than this. */
const MIN_PLAYER_DIST = 6;

export class Spawner {
  private readonly slots: Slot[];

  constructor(private readonly world: World, spawns: SpawnDef[]) {
    this.slots = spawns.map((def) => ({ def, entity: this.spawn(def), timeToRespawn: 0, taken: null }));
  }

  readonly system: System = (world, dt) => {
    for (const slot of this.slots) {
      if (slot.entity !== null) {
        if (world.isAlive(slot.entity)) continue;
        slot.entity = null;
        slot.timeToRespawn = slot.def.respawnTime;
      }
      if (slot.taken !== null) continue;
      slot.timeToRespawn -= dt;
      if (slot.timeToRespawn <= 0) slot.entity = this.spawn(slot.def);
    }
  };

  spawnOf(e: Entity): SpawnDef | undefined {
    return this.slots.find((s) => s.entity === e)?.def;
  }

  take(actor: Entity): void {
    const slot = this.slots.find((s) => s.entity === actor);
    this.world.destroy(actor);
    if (slot) slot.taken = actor;
  }

  release(actor: Entity): void {
    for (const slot of this.slots) if (slot.taken === actor) slot.taken = null;
  }

  private spawn(def: SpawnDef): Entity {
    return spawnActor(this.world, def.enemy, this.placeAway(def.at, def.away ?? { x: -def.at.x, z: def.at.z }),
      ENEMIES[def.enemy].overworld());
  }

  private placeAway(at: Vec2, away: Vec2): Vec2 {
    for (const [, , pos] of this.world.query(OverworldPlayer, OverworldPos)) {
      if (distXZ(pos, at) < MIN_PLAYER_DIST) return away;
    }
    return at;
  }
}
