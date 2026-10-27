/** Builds the `state` message: what the client may know about the overworld right now. */
import {
  roundTo, VIEW, viewCenter, viewHalfWidth, type ActorSnap, type ServerMsgOf,
} from "@infinite-tower/shared";
import type { Overworld } from "../overworld/overworld.js";
import { OverworldActor, OverworldPos } from "../overworld/components.js";

/** 1 cm, far below what can be seen, takes each actor from ~140 to ~90 bytes of JSON. */
const forWire = (x: number) => roundTo(x, 2);

/**
 * Only actors this many tiles around the player's screen are sent, so a hacked client can't see further. The margin
 * covers the client's screen never quite matching the server's copy (prediction, the camera's lag, sprite widths).
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
