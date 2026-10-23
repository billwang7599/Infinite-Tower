/** Mirrors the server's field actors: spawn new ones, update the rest, remove the ones that are gone. */
import type { ActorSnap, Entity, World } from "@infinite-tower/shared";
import { FieldActor } from "./components.js";
import { FIELD_PREFABS } from "./entities/index.js";
import type { FieldView } from "./scene.js";

export class ActorMirror {
  /** Server entity id -> local entity. */
  private readonly local = new Map<number, Entity>();

  constructor(private readonly world: World, private readonly view: FieldView) {}

  apply(snaps: ActorSnap[]): void {
    const seen = new Set<number>();
    for (const s of snaps) {
      seen.add(s.id);
      let e = this.local.get(s.id);
      if (e === undefined) {
        e = FIELD_PREFABS[s.kind](this.world, this.view, { x: s.x, z: s.z });
        this.local.set(s.id, e);
      }
      const a = this.world.require(e, FieldActor);
      a.target = { x: s.x, z: s.z };
      a.vx = s.vx;
      a.vz = s.vz;
      a.facing = s.facing;
      a.alert = s.alert;
    }
    for (const [id, e] of this.local) if (!seen.has(id)) this.remove(id, e);
    this.world.flush();
  }

  /** Forget every actor (entering another level). */
  clear(): void {
    for (const [id, e] of this.local) this.remove(id, e);
    this.world.flush();
  }

  private remove(id: number, e: Entity): void {
    this.world.destroy(e);
    this.local.delete(id);
  }
}
