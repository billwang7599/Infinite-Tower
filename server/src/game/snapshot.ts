/** Builds the `state` message: what the client may know about the field right now. */
import type { ActorSnap, MsgOf, ServerMsg } from "@infinite-tower/shared";
import { FieldActor, FieldPlayer, FieldPos } from "../field/components.js";
import type { Session } from "./session.js";

export function stateMsg(session: Session): MsgOf<ServerMsg, "state"> {
  const { world } = session;
  const actors: ActorSnap[] = [];
  for (const [id, a, p] of world.query(FieldActor, FieldPos)) {
    actors.push({ id, kind: a.kind, x: p.x, z: p.z, vx: a.vx, vz: a.vz, facing: a.facing, alert: a.alert });
  }
  const ack = world.require(session.player, FieldPlayer).ack;
  return { t: "state", ack, me: session.playerPos(), actors, wins: session.wins };
}
