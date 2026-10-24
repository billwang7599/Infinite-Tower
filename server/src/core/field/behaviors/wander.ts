/** Wander: idle a while, walk to a random nearby point, repeat. Holds off while a higher behavior is busy. */
import { clampToLevel, defineComponent, type System } from "@infinite-tower/shared";
import { FieldActor, FieldPos } from "../components.js";
import type { FieldContext } from "../context.js";
import { part } from "../parts.js";

export interface WanderData {
  speed: number;
  minDist: number;
  maxDist: number;
  state: "idle" | "walk";
  t: number;
  /** How long to idle. */
  duration: number;
  tx: number;
  tz: number;
  wasBusy: boolean;
}
export const Wander = defineComponent<WanderData>("Wander");

export const wander = (o: { speed: number; minDist?: number; maxDist?: number }) =>
  part(Wander, { minDist: 2, maxDist: 7, ...o, state: "idle", t: 0, duration: 1, tx: 0, tz: 0, wasBusy: false });

/** Give up walking somewhere after this long (stuck on the edge). */
const MAX_WALK = 8;

export function wanderSystem(ctx: FieldContext): System {
  return (world, dt) => {
    for (const [, w, pos, actor] of world.query(Wander, FieldPos, FieldActor)) {
      if (actor.busy) { w.wasBusy = true; continue; }
      w.t += dt;
      if (w.wasBusy) { // just lost interest: catch its breath first
        Object.assign(w, { wasBusy: false, state: "idle", t: 0, duration: 1.5 });
      }
      actor.vx = actor.vz = 0;
      if (w.state === "idle") {
        if (w.t < w.duration) continue;
        const a = ctx.rng() * Math.PI * 2, r = w.minDist + ctx.rng() * (w.maxDist - w.minDist);
        const target = { x: pos.x + Math.cos(a) * r, z: pos.z + Math.sin(a) * r };
        clampToLevel(ctx.level.layout, target);
        Object.assign(w, { state: "walk", t: 0, tx: target.x, tz: target.z });
        continue;
      }
      const dx = w.tx - pos.x, dz = w.tz - pos.z, d = Math.hypot(dx, dz);
      if (d < 0.15 || w.t > MAX_WALK) {
        Object.assign(w, { state: "idle", t: 0, duration: 1 + ctx.rng() * 2.5 });
      } else {
        actor.vx = (dx / d) * w.speed;
        actor.vz = (dz / d) * w.speed;
      }
    }
  };
}
