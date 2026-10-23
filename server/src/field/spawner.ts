/**
 * Spawns a level's actors when it loads (one per SpawnDef) and replaces defeated ones after
 * `respawn` seconds, away from the player if they're standing near the spawn point.
 */
import { distXZ, type Entity, type System, type Vec2, type World } from "@infinite-tower/shared";
import type { SpawnDef } from "../levels/level.js";
import { findPrey, type FieldContext } from "./context.js";
import { FIELD_PREFABS } from "./prefabs/index.js";

interface Slot { def: SpawnDef; entity: Entity | null; timer: number }

/** Don't pop in closer to the player than this. */
const MIN_PLAYER_DIST = 6;

export class Spawner {
  private readonly slots: Slot[];

  constructor(private readonly world: World, ctx: FieldContext) {
    this.slots = ctx.level.spawns.map((def) => ({ def, entity: this.spawn(def), timer: 0 }));
  }

  readonly system: System = (world, dt) => {
    for (const slot of this.slots) {
      if (slot.entity !== null) {
        if (world.isAlive(slot.entity)) continue;
        slot.entity = null;
        slot.timer = slot.def.respawn;
      }
      slot.timer -= dt;
      if (slot.timer <= 0) slot.entity = this.spawn(slot.def);
    }
  };

  /** Remove everything this spawner made (leaving the level). */
  clear(): void {
    for (const slot of this.slots) if (slot.entity !== null) this.world.destroy(slot.entity);
    this.world.flush();
  }

  private spawn(def: SpawnDef): Entity {
    return FIELD_PREFABS[def.prefab](this.world, this.placeAway(def.at));
  }

  private placeAway(at: Vec2): Vec2 {
    const prey = findPrey(this.world);
    if (prey && distXZ(prey.pos, at) < MIN_PLAYER_DIST) return { x: -at.x, z: at.z };
    return at;
  }
}
