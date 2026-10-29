import type { ActorSnap, Character, Entity, PlayerSnap, World } from "@infinite-tower/shared";
import { OverworldActor, OverworldPos, Peer } from "./components.js";
import { faceToward, headingFromSide } from "./facing.js";

export class ActorMirror {
  /** Server id -> local entity. */
  private readonly local = new Map<number, Entity>();
  /** A player's character comes only when the server starts sending them (again, after they were out of view). */
  private readonly characters = new Map<number, Character>();

  constructor(private readonly world: World) {}

  apply(actors: ActorSnap[], players: PlayerSnap[]): void {
    const seen = new Set<number>();
    for (const s of actors) {
      seen.add(s.id);
      const actor = this.mirror(s.id, s, s.kind);
      Object.assign(actor, { vx: s.vx, vz: s.vz, heading: headingFromSide(s.facing), alert: s.alert });
    }
    for (const s of players) {
      if (s.character) this.characters.set(s.id, s.character);
      const character = this.characters.get(s.id);
      if (!character) continue;
      seen.add(s.id);
      const actor = this.mirror(s.id, s, "peer");
      Object.assign(actor, { vx: s.vx, vz: s.vz, heading: faceToward(actor.heading, s.vx, s.vz) });
      const e = this.local.get(s.id)!;
      if (this.world.get(e, Peer)) Object.assign(this.world.require(e, Peer), { character, fighting: s.fighting });
      else this.world.add(e, Peer, { character, fighting: s.fighting });
    }
    for (const [id, e] of this.local) if (!seen.has(id)) this.remove(id, e);
    for (const id of this.characters.keys()) if (!players.some((s) => s.id === id)) this.characters.delete(id);
    this.world.flush();
  }

  /** Entering another level. */
  clear(): void {
    for (const [id, e] of this.local) this.remove(id, e);
    this.characters.clear();
    this.world.flush();
  }

  private mirror(id: number, at: { x: number; z: number }, kind: ActorSnap["kind"] | "peer") {
    let e = this.local.get(id);
    if (e === undefined) {
      e = this.world.spawn();
      this.world.add(e, OverworldPos, { x: at.x, z: at.z });
      const heading = kind === "peer" ? "south" : "west";
      this.world.add(e, OverworldActor, { kind, vx: 0, vz: 0, heading, alert: false });
      this.local.set(id, e);
    }
    Object.assign(this.world.require(e, OverworldPos), { x: at.x, z: at.z });
    return this.world.require(e, OverworldActor);
  }

  private remove(id: number, e: Entity): void {
    this.world.destroy(e);
    this.local.delete(id);
  }
}
