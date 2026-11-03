import {
  faceToward, type ActorSnap, type Character, type Entity, type Heading, type WorldLayout, type PileSnap,
  type PlayerSnap, type Vec2, type World,
} from "@infinite-tower/shared";
import { Npc, OverworldActor, OverworldPos, Peer, type OverworldActorData } from "./components.js";
import { headingFromSide } from "./facing.js";

export class ActorMirror {
  /** Server id -> local entity. */
  private readonly local = new Map<number, Entity>();
  private readonly characters = new Map<number, Character>();
  private placed: Entity[] = [];

  constructor(private readonly world: World) {}

  apply(actors: ActorSnap[], players: PlayerSnap[], piles: PileSnap[]): void {
    const seen = new Set<number>();
    for (const s of piles) {
      seen.add(s.id);
      this.mirror(s.id, s, "pile");
    }
    for (const s of actors) {
      seen.add(s.id);
      const actor = this.world.require(this.mirror(s.id, s, s.kind), OverworldActor);
      Object.assign(actor, { vx: s.vx, vz: s.vz, heading: headingFromSide(s.facing), alert: s.alert });
    }
    for (const s of players) {
      if (s.character) this.characters.set(s.id, s.character);
      const character = this.characters.get(s.id);
      if (!character) continue;
      seen.add(s.id);
      const e = this.mirror(s.id, s, "peer"), actor = this.world.require(e, OverworldActor);
      Object.assign(actor, { vx: s.vx, vz: s.vz, heading: faceToward(actor.heading, s.vx, s.vz) });
      this.world.add(e, Peer, { character, fighting: s.fighting });
    }
    for (const [id, e] of this.local) if (!seen.has(id)) this.remove(id, e);
    for (const id of this.characters.keys()) if (!players.some((s) => s.id === id)) this.characters.delete(id);
    this.world.flush();
  }

  entityOf(id: number): Entity | undefined {
    return this.local.get(id);
  }

  enter(placed: Pick<WorldLayout, "npcs" | "traces">): void {
    this.clear();
    this.place(placed);
  }

  place({ npcs, traces }: Pick<WorldLayout, "npcs" | "traces">): void {
    for (const e of this.placed) this.world.destroy(e);
    this.world.flush();
    const place = (at: Vec2, kind: "npc" | "trace", heading: Heading) => {
      const e = this.world.spawn();
      this.world.add(e, OverworldPos, { x: at.x, z: at.z });
      this.world.add(e, OverworldActor, { kind, vx: 0, vz: 0, heading, alert: false });
      return e;
    };
    this.placed = [
      ...npcs.map(({ npc, at, heading }) => {
        const e = place(at, "npc", heading);
        this.world.add(e, Npc, { id: npc });
        return e;
      }),
      ...traces.map((at) => place(at, "trace", "west")),
    ];
  }

  clear(): void {
    for (const [id, e] of this.local) this.remove(id, e);
    for (const e of this.placed) this.world.destroy(e);
    this.placed = [];
    this.characters.clear();
    this.world.flush();
  }

  private mirror(id: number, at: { x: number; z: number }, kind: OverworldActorData["kind"]): Entity {
    let e = this.local.get(id);
    if (e === undefined) {
      e = this.world.spawn();
      this.world.add(e, OverworldPos, { x: at.x, z: at.z });
      const heading = kind === "peer" ? "south" : "west";
      this.world.add(e, OverworldActor, { kind, vx: 0, vz: 0, heading, alert: false });
      this.local.set(id, e);
    }
    Object.assign(this.world.require(e, OverworldPos), { x: at.x, z: at.z });
    return e;
  }

  private remove(id: number, e: Entity): void {
    this.world.destroy(e);
    this.local.delete(id);
  }
}
