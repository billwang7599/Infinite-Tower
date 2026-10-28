/** Spawns a level's actors and replaces defeated ones after `respawnTime`, away from the player if they're near. */
import { distXZ, type Entity, type System, type Vec2, type World } from "@infinite-tower/shared";
import { ENEMIES } from "../enemies/index.js";
import type { SpawnDef } from "../levels/level.js";
import { spawnActor } from "./parts.js";
import { findPlayer } from "./player.js";

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

  /** Leaving the level. */
  clear(): void {
    for (const slot of this.slots) if (slot.entity !== null) this.world.destroy(slot.entity);
    this.world.flush();
  }

  private spawn(def: SpawnDef): Entity {
    return spawnActor(this.world, def.enemy, this.placeAway(def.at), ENEMIES[def.enemy].overworld());
  }

  private placeAway(at: Vec2): Vec2 {
    const player = findPlayer(this.world);
    if (player && distXZ(player.pos, at) < MIN_PLAYER_DIST) return { x: -at.x, z: at.z };
    return at;
  }
}
