import { INTERACT_LOOK_RAD, INTERACT_RANGE_M, inView, type Vec2 } from "@infinite-tower/shared";

/** Leeway on a reach the server checks (a campfire's, a battle's): its copy of you trails the client's. */
export const LAG_SLACK_TILES = 0.6;
/** Leeway on the reach and the look of Interact, for the same reason. */
export const INTERACT_LAG_SLACK_M = 1;
export const INTERACT_LOOK_SLACK_RAD = (15 * Math.PI) / 180;

export const inViewWithSlack = <T extends Vec2>(me: Vec2, way: Vec2, things: readonly T[]): T | null =>
  inView(me, way, things, INTERACT_RANGE_M + INTERACT_LAG_SLACK_M, INTERACT_LOOK_RAD + INTERACT_LOOK_SLACK_RAD);
