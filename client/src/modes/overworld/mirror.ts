/** Mirrors the server's overworld actors: spawn new ones, update the rest, remove the ones that are gone. */
import type { ActorSnap, Entity, World } from "@infinite-tower/shared";
import { OverworldActor, OverworldPos } from "./components.js";
import { headingFromSide } from "./facing.js";

export class ActorMirror {
  /** Server id -> local entity. */
  private readonly local = new Map<number, Entity>();

  constructor(private readonly world: World) {}

  apply(snaps: ActorSnap[]): void {
    const seen = new Set<number>();
    for (const s of snaps) {
      seen.add(s.id);
      let e = this.local.get(s.id);
      if (e === undefined) {
        e = this.world.spawn();
        this.world.add(e, OverworldPos, { x: s.x, z: s.z });
        this.world.add(e, OverworldActor, { kind: s.kind, vx: 0, vz: 0, heading: "west", alert: false });
        this.local.set(s.id, e);
      }
      Object.assign(this.world.require(e, OverworldPos), { x: s.x, z: s.z });
      Object.assign(this.world.require(e, OverworldActor), {
        vx: s.vx, vz: s.vz, heading: headingFromSide(s.facing), alert: s.alert,
      });
    }
    for (const [id, e] of this.local) if (!seen.has(id)) this.remove(id, e);
    this.world.flush();
  }

  /** Entering another level. */
  clear(): void {
    for (const [id, e] of this.local) this.remove(id, e);
    this.world.flush();
  }

  private remove(id: number, e: Entity): void {
    this.world.destroy(e);
    this.local.delete(id);
  }
}
