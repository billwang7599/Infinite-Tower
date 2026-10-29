/** Builds the `state` message: what the client may know about the overworld right now. */
import {
  distXZ, roundTo, type ActorSnap, type Entity, type PileSnap, type PlayerSnap, type ServerMsgOf,
} from "@infinite-tower/shared";
import type { Overworld } from "../overworld/overworld.js";
import { OverworldActor, OverworldPlayer, OverworldPos, Pile } from "../overworld/components.js";

/** 1 cm, far below what can be seen, takes each actor from ~140 to ~90 bytes of JSON. */
const forWire = (x: number) => roundTo(x, 2);

/**
 * Only actors this many tiles round the player are sent, so a hacked client can't see further. The camera may look
 * any way, and at 16:9 its far corners are about 17 tiles off; the rest covers its lag and tall sprites.
 */
export const VIEW_RADIUS_TILES = 20;

export function stateMsg(overworld: Overworld, player: Entity, introduced: Set<Entity>): ServerMsgOf<"state"> {
  const me = overworld.playerPos(player);
  const actors: ActorSnap[] = [];
  for (const [id, a, p] of overworld.world.query(OverworldActor, OverworldPos)) {
    if (distXZ(p, me) > VIEW_RADIUS_TILES) continue;
    actors.push({
      id, kind: a.kind, x: forWire(p.x), z: forWire(p.z), vx: forWire(a.vx), vz: forWire(a.vz), facing: a.facing,
      alert: a.alert,
    });
  }
  const players: PlayerSnap[] = [];
  for (const [id, walk, p] of overworld.world.query(OverworldPlayer, OverworldPos)) {
    if (id === player || distXZ(p, me) > VIEW_RADIUS_TILES) continue;
    const snap: PlayerSnap = {
      id, x: forWire(p.x), z: forWire(p.z), vx: forWire(walk.vx), vz: forWire(walk.vz), fighting: walk.fighting,
    };
    if (!introduced.has(id)) {
      snap.character = walk.character;
      introduced.add(id);
    }
    players.push(snap);
  }
  for (const id of introduced) if (!players.some((p) => p.id === id)) introduced.delete(id);
  const piles: PileSnap[] = [];
  for (const [id, , p] of overworld.world.query(Pile, OverworldPos)) {
    if (distXZ(p, me) <= VIEW_RADIUS_TILES) piles.push({ id, x: forWire(p.x), z: forWire(p.z) });
  }
  const ack = overworld.playerData(player).ack;
  return { t: "state", ack, me: { x: forWire(me.x), z: forWire(me.z) }, actors, players, piles };
}
