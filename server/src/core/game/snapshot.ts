/** Builds the `state` message: what the client may know about the overworld right now. */
import {
  roundTo, VIEW, viewCenter, viewHalfWidth, type ActorSnap, type ServerMsgOf,
} from "@infinite-tower/shared";
import type { Overworld } from "../overworld/overworld.js";
import { OverworldActor, OverworldPos } from "../overworld/components.js";

/**
 * Numbers go out as JSON text, where a raw float is ~18 characters. 2 decimals is 1 cm, far below
 * what can be seen, and takes each actor in `state` (sent 20x/s) from ~140 to ~90 bytes.
 */
const forWire = (x: number) => roundTo(x, 2);

/**
 * Only actors this many tiles around the player's screen are sent, so a hacked client can't see further. The
 * margin is because the screen never quite matches the server's copy: the client predicts ahead of it, its
 * camera trails, sprites have width and other actors are drawn a little late. Actors then appear and vanish
 * off-screen, even on a slow connection.
 */
const VIEW_MARGIN_TILES = 3;

/** The server doesn't know the window's shape, so it assumes the widest one allowed. */
const VIEW_HALF_WIDTH = viewHalfWidth(VIEW.maxAspect);

export function stateMsg(overworld: Overworld): ServerMsgOf<"state"> {
  const me = overworld.playerPos();
  const center = viewCenter(overworld.level.layout, me, VIEW_HALF_WIDTH);
  const reachX = VIEW_HALF_WIDTH + VIEW_MARGIN_TILES, reachZ = VIEW.halfHeight + VIEW_MARGIN_TILES;
  const actors: ActorSnap[] = [];
  for (const [id, a, p] of overworld.world.query(OverworldActor, OverworldPos)) {
    if (Math.abs(p.x - center.x) > reachX || Math.abs(p.z - center.z) > reachZ) continue;
    actors.push({
      id, kind: a.kind, x: forWire(p.x), z: forWire(p.z), vx: forWire(a.vx), vz: forWire(a.vz), facing: a.facing,
      alert: a.alert,
    });
  }
  return { t: "state", ack: overworld.playerData().ack, me: { x: forWire(me.x), z: forWire(me.z) }, actors };
}
