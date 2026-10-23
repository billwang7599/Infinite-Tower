/** Mirrors the server's map boars: spawn new ones, update the rest, remove the ones that are gone. */
import type { Entity, FieldBoarSnap, World } from "@infinite-tower/shared";
import { MapActor } from "./components.js";
import type { MapView } from "./scene.js";
import { spawnMapBoar } from "./spawn.js";

export class BoarMirror {
  /** Server entity id -> local entity. */
  private readonly local = new Map<number, Entity>();

  constructor(private readonly world: World, private readonly view: MapView) {}

  apply(snaps: FieldBoarSnap[]): void {
    const seen = new Set<number>();
    for (const s of snaps) {
      seen.add(s.id);
      let e = this.local.get(s.id);
      if (e === undefined) {
        e = spawnMapBoar(this.world, this.view, s);
        this.local.set(s.id, e);
      }
      const a = this.world.require(e, MapActor);
      a.target = { x: s.x, z: s.z };
      a.vx = s.vx;
      a.vz = s.vz;
      a.facing = s.facing;
      a.alert = s.alert;
    }
    for (const [id, e] of this.local) {
      if (seen.has(id)) continue;
      this.world.destroy(e);
      this.local.delete(id);
    }
    this.world.flush();
  }
}
