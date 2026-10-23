/** Chase on sight: notice the player nearby ("!"), pause, run at them; give up if they get away. */
import { defineComponent, type System } from "@infinite-tower/shared";
import { Actor, FieldPos } from "../components.js";
import { findPrey } from "../context.js";
import { part } from "../parts.js";

export interface ChaseOnSightData {
  /** Notices the player within this distance... */
  range: number;
  /** ...stands still this long with a "!"... */
  delay: number;
  /** ...then runs at them at this speed... */
  speed: number;
  /** ...until they're further than this. */
  giveUp: number;
  state: "calm" | "notice" | "chase";
  t: number;
}
export const ChaseOnSight = defineComponent<ChaseOnSightData>("ChaseOnSight");

export const chaseOnSight = (o: { range: number; delay: number; speed: number; giveUp?: number }) =>
  part(ChaseOnSight, { giveUp: o.range * 1.8, ...o, state: "calm", t: 0 });

export function chaseSystem(): System {
  return (world, dt) => {
    const prey = findPrey(world);
    for (const [, c, pos, actor] of world.query(ChaseOnSight, FieldPos, Actor)) {
      c.t += dt;
      const dx = prey ? prey.pos.x - pos.x : 0, dz = prey ? prey.pos.z - pos.z : 0;
      const dist = prey ? Math.hypot(dx, dz) : Infinity;
      const safe = !prey || prey.safe;

      if (c.state === "calm" && !safe && dist < c.range) { c.state = "notice"; c.t = 0; }
      else if (c.state === "chase" && (safe || dist > c.giveUp)) { c.state = "calm"; c.t = 0; }

      if (c.state === "notice") {
        actor.vx = actor.vz = 0;
        if (Math.abs(dx) > 0.1) actor.facing = dx > 0 ? 1 : -1;
        if (c.t >= c.delay) { c.state = "chase"; c.t = 0; }
      } else if (c.state === "chase" && dist > 0.01) {
        actor.vx = (dx / dist) * c.speed;
        actor.vz = (dz / dist) * c.speed;
      }
      actor.busy = actor.alert = c.state !== "calm";
    }
  };
}
