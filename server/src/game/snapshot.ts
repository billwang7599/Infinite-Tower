/** Builds the `state` message: what the client may know about the field right now. */
import { roundTo, type ActorSnap, type MsgOf, type ServerMsg } from "@infinite-tower/shared";
import { FieldActor, FieldPlayer, FieldPos } from "../field/components.js";
import type { Session } from "./session.js";

/**
 * Numbers go out as JSON text, where a raw float is ~18 characters. 2 decimals is 1 cm, far below
 * what can be seen, and takes each actor in `state` (sent 20x/s) from ~140 to ~90 bytes.
 */
const net = (x: number) => roundTo(x, 2);

export function stateMsg(session: Session): MsgOf<ServerMsg, "state"> {
  const { world } = session;
  const actors: ActorSnap[] = [];
  for (const [id, a, p] of world.query(FieldActor, FieldPos)) {
    actors.push({ id, kind: a.kind, x: net(p.x), z: net(p.z), vx: net(a.vx), vz: net(a.vz), facing: a.facing, alert: a.alert });
  }
  const ack = world.require(session.player, FieldPlayer).ack;
  const me = session.playerPos();
  return { t: "state", ack, me: { x: net(me.x), z: net(me.z) }, actors, wins: session.wins };
}
