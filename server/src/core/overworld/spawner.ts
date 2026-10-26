/**
 * Spawns a level's actors when it loads (one per SpawnDef) and replaces defeated ones after
 * `respawnTime` seconds, away from the player if they're standing near the spawn point.
 */
import { distXZ, type Entity, type System, type Vec2, type World } from "@infinite-tower/shared";
import type { SpawnDef } from "../levels/level.js";
import { findPlayer } from "./player.js";
import { OVERWORLD_PREFABS } from "./prefabs/index.js";

interface Slot {
  def: SpawnDef;
  entity: Entity | null;
  /** Seconds until a defeated actor comes back. */
  timeToRespawn: number;
}

/** Don't pop in closer to the player than this. */
const MIN_PLAYER_DIST = 6;

export class Spawner {
  private readonly slots: Slot[];

  constructor(private readonly world: World, spawns: SpawnDef[]) {
    this.slots = spawns.map((def) => ({ def, entity: this.spawn(def), timeToRespawn: 0 }));
  }

  readonly system: System = (world, dt) => {
    for (const slot of this.slots) {
      if (slot.entity !== null) {
        if (world.isAlive(slot.entity)) continue;
        slot.entity = null;
        slot.timeToRespawn = slot.def.respawnTime;
      }
      slot.timeToRespawn -= dt;
      if (slot.timeToRespawn <= 0) slot.entity = this.spawn(slot.def);
    }
  };

  /** Remove everything this spawner made (leaving the level). */
  clear(): void {
    for (const slot of this.slots) if (slot.entity !== null) this.world.destroy(slot.entity);
    this.world.flush();
  }

  private spawn(def: SpawnDef): Entity {
    return OVERWORLD_PREFABS[def.prefab](this.world, this.placeAway(def.at));
  }

  private placeAway(at: Vec2): Vec2 {
    const player = findPlayer(this.world);
    if (player && distXZ(player.pos, at) < MIN_PLAYER_DIST) return { x: -at.x, z: at.z };
    return at;
  }
}
