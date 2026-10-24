/** Builds the `state` message: what the client may know about the field right now. */
import { roundTo, VIEW, viewCenter, viewHalfWidth, type ActorSnap, type MsgOf, type ServerMsg } from "@infinite-tower/shared";
import { FieldActor, FieldPlayer, FieldPos } from "../field/components.js";
import type { Session } from "./session.js";

/**
 * Numbers go out as JSON text, where a raw float is ~18 characters. 2 decimals is 1 cm, far below
 * what can be seen, and takes each actor in `state` (sent 20x/s) from ~140 to ~90 bytes.
 */
const net = (x: number) => roundTo(x, 2);

/**
 * Only actors this many tiles around the player's screen are sent, so a hacked client can't see further. The
 * margin is because the screen never quite matches the server's copy: the client predicts ahead of it, its
 * camera trails, sprites have width and other actors are drawn a little late. Actors then appear and vanish
 * off-screen, even on a slow connection.
 */
const MARGIN = 3;

/** The server doesn't know the window's shape, so it assumes the widest one allowed. */
const HALF_WIDTH = viewHalfWidth(VIEW.maxAspect);

export function stateMsg(session: Session): MsgOf<ServerMsg, "state"> {
  const { world } = session;
  const me = session.playerPos();
  const center = viewCenter(session.currentLevel.layout, me, HALF_WIDTH);
  const reachX = HALF_WIDTH + MARGIN, reachZ = VIEW.halfHeight + MARGIN;
  const actors: ActorSnap[] = [];
  for (const [id, a, p] of world.query(FieldActor, FieldPos)) {
    if (Math.abs(p.x - center.x) > reachX || Math.abs(p.z - center.z) > reachZ) continue;
    actors.push({ id, kind: a.kind, x: net(p.x), z: net(p.z), vx: net(a.vx), vz: net(a.vz), facing: a.facing, alert: a.alert });
  }
  const ack = world.require(session.player, FieldPlayer).ack;
  return { t: "state", ack, me: { x: net(me.x), z: net(me.z) }, actors, wins: session.wins };
}
