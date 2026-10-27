/** The overworld kobold: paces its patch, comes at you on sight, and touching it starts a Kobold Swordsman fight. */
import type { Vec2, World } from "@infinite-tower/shared";
import { chaseOnSight } from "../behaviors/chase.js";
import { encounterOnTouch } from "../behaviors/touch.js";
import { wander } from "../behaviors/wander.js";
import { spawnActor } from "../parts.js";

export function spawnKobold(world: World, at: Vec2) {
  return spawnActor(world, "kobold", at, [
    wander({ speed: 1.2 }),
    chaseOnSight({ range: 4, noticeTime: 0.6, speed: 3 }),
    encounterOnTouch({ range: 0.9, enemy: "kobold-swordsman" }),
  ]);
}
