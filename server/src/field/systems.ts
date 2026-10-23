/**
 * Field rules, run only on the server: replaying the player's inputs, encounter rolls in tall grass,
 * and the wandering / chasing map boars. `onEncounter(source)` gets the boar that touched you, or null.
 */
import {
  clampToField, FIXED_DT, inTallGrass, stepWalker, type Entity, type System,
} from "@infinite-tower/shared";
import { ENCOUNTERS, FIELD, FIELD_BOAR as B } from "../content/field.js";
import { FieldBoar, FieldPlayer, FieldPos } from "./components.js";

export type EncounterHandler = (source: Entity | null) => void;

const MAX_CREDITS = 6;

export function fieldPlayerSystem(rng: () => number, onEncounter: EncounterHandler): System {
  return (world, dt) => {
    for (const [, fp, pos] of world.query(FieldPlayer, FieldPos)) {
      fp.safeTime = Math.max(0, fp.safeTime - dt);
      fp.credits = Math.min(MAX_CREDITS, fp.credits + 1);
      if (fp.queue.length === 0) { fp.vx = fp.vz = 0; continue; }

      while (fp.credits >= 1 && fp.queue.length > 0) {
        const input = fp.queue.shift()!;
        fp.credits--;
        fp.ack = input.seq;
        const ox = pos.x, oz = pos.z;
        const v = stepWalker(FIELD, pos, input, FIXED_DT);
        fp.vx = v.vx;
        fp.vz = v.vz;
        if (!inTallGrass(FIELD, pos.x, pos.z)) continue;
        fp.grassDist += Math.hypot(pos.x - ox, pos.z - oz);
        while (fp.grassDist >= ENCOUNTERS.grassStep) {
          fp.grassDist -= ENCOUNTERS.grassStep;
          if (fp.safeTime <= 0 && rng() < ENCOUNTERS.chance) {
            fp.queue.length = 0;
            onEncounter(null);
            return;
          }
        }
      }
    }
  };
}

export function fieldBoarSystem(rng: () => number, onEncounter: EncounterHandler): System {
  return (world, dt) => {
    const player = world.first(FieldPlayer, FieldPos);
    for (const [e, boar, pos] of world.query(FieldBoar, FieldPos)) {
      boar.t += dt;
      const dx = player ? player[2].x - pos.x : 0, dz = player ? player[2].z - pos.z : 0;
      const dist = player ? Math.hypot(dx, dz) : Infinity;
      const safe = !player || player[1].safeTime > 0;

      // Notice the player -> "!" -> chase; give up if they get away.
      if (!safe && dist < B.noticeRange && (boar.state === "idle" || boar.state === "wander")) {
        boar.state = "notice";
        boar.t = 0;
      } else if (boar.state === "chase" && (safe || dist > B.noticeRange * 1.8)) {
        boar.state = "idle";
        boar.t = 0;
        boar.duration = 1.5;
      }

      let vx = 0, vz = 0;
      switch (boar.state) {
        case "idle":
          if (boar.t >= boar.duration) {
            const a = rng() * Math.PI * 2, r = 2 + rng() * 5;
            const target = { x: pos.x + Math.cos(a) * r, z: pos.z + Math.sin(a) * r };
            clampToField(FIELD, target);
            boar.tx = target.x;
            boar.tz = target.z;
            boar.state = "wander";
            boar.t = 0;
          }
          break;
        case "wander": {
          const wx = boar.tx - pos.x, wz = boar.tz - pos.z, wd = Math.hypot(wx, wz);
          if (wd < 0.15 || boar.t > 8) {
            boar.state = "idle";
            boar.t = 0;
            boar.duration = 1 + rng() * 2.5;
          } else {
            vx = (wx / wd) * B.walkSpeed;
            vz = (wz / wd) * B.walkSpeed;
          }
          break;
        }
        case "notice":
          if (boar.t >= B.noticeDelay) { boar.state = "chase"; boar.t = 0; }
          break;
        case "chase":
          if (dist > 0.01) {
            vx = (dx / dist) * B.chaseSpeed;
            vz = (dz / dist) * B.chaseSpeed;
          }
          break;
      }
      if (boar.state === "notice" && Math.abs(dx) > 0.1) boar.facing = dx > 0 ? 1 : -1;
      else if (Math.abs(vx) > 0.1) boar.facing = vx > 0 ? 1 : -1;

      boar.vx = vx;
      boar.vz = vz;
      pos.x += vx * dt;
      pos.z += vz * dt;
      clampToField(FIELD, pos);

      if (!safe && dist < B.touchRange) {
        onEncounter(e);
        return;
      }
    }
  };
}
