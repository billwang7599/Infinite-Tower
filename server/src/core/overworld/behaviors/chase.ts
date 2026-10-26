/** Chase on sight: notice the player nearby ("!"), pause, run at them; give up if they get away. */
import { defineComponent, type System } from "@infinite-tower/shared";
import { OverworldActor, OverworldPos } from "../components.js";
import { part } from "../parts.js";
import { findPlayer } from "../player.js";
import { faceToward, steerToward } from "./move.js";

export interface ChaseOnSightData {
  /** Notices the player within this distance... */
  range: number;
  /** ...stands still this long with a "!"... */
  noticeTime: number;
  /** ...then runs at them at this speed... */
  speed: number;
  /** ...until they're further than this. */
  giveUpDist: number;
  state: "calm" | "notice" | "chase";
  /** Seconds in the current state. */
  stateTime: number;
}
export const ChaseOnSight = defineComponent<ChaseOnSightData>("ChaseOnSight");

export const chaseOnSight = (o: { range: number; noticeTime: number; speed: number; giveUpDist?: number }) =>
  part(ChaseOnSight, { giveUpDist: o.range * 1.8, ...o, state: "calm", stateTime: 0 });

export function chaseSystem(): System {
  return (world, dt) => {
    const player = findPlayer(world);
    for (const [, c, pos, actor] of world.query(ChaseOnSight, OverworldPos, OverworldActor)) {
      c.stateTime += dt;
      const dx = player ? player.pos.x - pos.x : 0, dz = player ? player.pos.z - pos.z : 0;
      const dist = player ? Math.hypot(dx, dz) : Infinity;
      const safe = !player || player.safe;

      if (c.state === "calm" && !safe && dist < c.range) { c.state = "notice"; c.stateTime = 0; }
      else if (c.state === "chase" && (safe || dist > c.giveUpDist)) {
        c.state = "calm";
        c.stateTime = 0;
        actor.vx = actor.vz = 0;
      }

      if (c.state === "notice") {
        actor.vx = actor.vz = 0;
        faceToward(actor, dx);
        if (c.stateTime >= c.noticeTime) { c.state = "chase"; c.stateTime = 0; }
      } else if (c.state === "chase" && dist > 0.01) {
        steerToward(actor, dx, dz, dist, c.speed);
      }
      actor.busy = actor.alert = c.state !== "calm";
    }
  };
}
