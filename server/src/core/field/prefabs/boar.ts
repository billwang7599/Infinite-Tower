/** The field boar: wanders, charges at you on sight, and touching it starts a Wild Boar fight. */
import type { Vec2, World } from "@infinite-tower/shared";
import { chaseOnSight } from "../behaviors/chase.js";
import { encounterOnTouch } from "../behaviors/touch.js";
import { wander } from "../behaviors/wander.js";
import { spawnActor } from "../parts.js";

export function spawnBoar(world: World, at: Vec2) {
  return spawnActor(world, "boar", at, [
    wander({ speed: 1.6 }),
    chaseOnSight({ range: 4.5, noticeTime: 0.5, speed: 3.4 }),
    encounterOnTouch({ range: 0.9, enemy: "wild-boar" }),
  ]);
}
