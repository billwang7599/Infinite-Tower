/** Wander: idle a while, walk to a random nearby point, repeat. Holds off while a higher behavior is busy. */
import { clampToLevel, defineComponent, type System } from "@infinite-tower/shared";
import { FieldActor, FieldPos } from "../components.js";
import type { FieldContext } from "../context.js";
import { part } from "../parts.js";
import { steerToward } from "./move.js";

export interface WanderData {
  speed: number;
  minDist: number;
  maxDist: number;
  state: "idle" | "walk";
  /** Seconds in the current state. */
  stateTime: number;
  idleDuration: number;
  targetX: number;
  targetZ: number;
  wasBusy: boolean;
}
export const Wander = defineComponent<WanderData>("Wander");

export const wander = (o: { speed: number; minDist?: number; maxDist?: number }) => part(Wander, {
  minDist: 2, maxDist: 7, ...o, state: "idle", stateTime: 0, idleDuration: 1, targetX: 0, targetZ: 0, wasBusy: false,
});

/** Give up walking somewhere after this long (stuck on the edge). */
const MAX_WALK_TIME = 8;

export function wanderSystem(ctx: FieldContext): System {
  return (world, dt) => {
    for (const [, w, pos, actor] of world.query(Wander, FieldPos, FieldActor)) {
      if (actor.busy) { w.wasBusy = true; continue; }
      w.stateTime += dt;
      if (w.wasBusy) { // just lost interest: catch its breath first
        Object.assign(w, { wasBusy: false, state: "idle", stateTime: 0, idleDuration: 1.5 });
      }
      actor.vx = actor.vz = 0;
      if (w.state === "idle") {
        if (w.stateTime < w.idleDuration) continue;
        const angle = ctx.rng() * Math.PI * 2, walkDist = w.minDist + ctx.rng() * (w.maxDist - w.minDist);
        const target = { x: pos.x + Math.cos(angle) * walkDist, z: pos.z + Math.sin(angle) * walkDist };
        clampToLevel(ctx.level.layout, target);
        Object.assign(w, { state: "walk", stateTime: 0, targetX: target.x, targetZ: target.z });
        continue;
      }
      const dx = w.targetX - pos.x, dz = w.targetZ - pos.z, dist = Math.hypot(dx, dz);
      if (dist < 0.15 || w.stateTime > MAX_WALK_TIME) {
        Object.assign(w, { state: "idle", stateTime: 0, idleDuration: 1 + ctx.rng() * 2.5 });
      } else {
        steerToward(actor, dx, dz, dist, w.speed);
      }
    }
  };
}
