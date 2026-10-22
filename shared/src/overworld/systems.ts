/**
 * Overworld rules: walking, tall-grass encounters, wandering/chasing boars. Pure 2D math, no engine.
 * An encounter calls `onEncounter(source)`: the boar entity that touched you, or null for tall grass.
 */
import type { Entity, System } from "../core/ecs.js";
import { PlayerInput } from "../core/input.js";
import { MapBoar, MapPlayer, MapPos } from "./components.js";
import { MAP } from "./constants.js";

export type EncounterHandler = (source: Entity | null) => void;

export function inTallGrass(x: number, z: number): boolean {
  const g = MAP.grass;
  return x >= g.x && x <= g.x + g.w && z >= g.z && z <= g.z + g.h;
}

export function clampToField(pos: { x: number; z: number }): void {
  const mx = MAP.halfWidth - MAP.border, mz = MAP.halfDepth - MAP.border;
  pos.x = Math.max(-mx, Math.min(mx, pos.x));
  pos.z = Math.max(-mz, Math.min(mz, pos.z));
}

export function mapPlayerSystem(rng: () => number, onEncounter: EncounterHandler): System {
  return (world, dt) => {
    for (const [, mp, input, pos] of world.query(MapPlayer, PlayerInput, MapPos)) {
      let ix = input.moveX, iz = input.moveZ;
      const len = Math.hypot(ix, iz);
      if (len > 1) { ix /= len; iz /= len; }
      mp.vx = ix * MAP.playerSpeed;
      mp.vz = iz * MAP.playerSpeed;
      if (Math.abs(ix) > 0.1) mp.facing = ix > 0 ? 1 : -1;

      const ox = pos.x, oz = pos.z;
      pos.x += mp.vx * dt;
      pos.z += mp.vz * dt;
      clampToField(pos);
      mp.safeTime = Math.max(0, mp.safeTime - dt);

      if (inTallGrass(pos.x, pos.z)) {
        mp.grassDist += Math.hypot(pos.x - ox, pos.z - oz);
        while (mp.grassDist >= MAP.grassStep) {
          mp.grassDist -= MAP.grassStep;
          if (mp.safeTime <= 0 && rng() < MAP.encounterChance) {
            onEncounter(null);
            return;
          }
        }
      }
    }
  };
}

export function mapBoarSystem(rng: () => number, onEncounter: EncounterHandler): System {
  const B = MAP.boar;
  return (world, dt) => {
    const player = world.first(MapPlayer, MapPos);
    for (const [e, boar, pos] of world.query(MapBoar, MapPos)) {
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
            // Wander somewhere nearby.
            const a = rng() * Math.PI * 2, r = 2 + rng() * 5;
            const target = { x: pos.x + Math.cos(a) * r, z: pos.z + Math.sin(a) * r };
            clampToField(target);
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
      clampToField(pos);

      if (!safe && dist < B.touchRange) {
        onEncounter(e);
        return;
      }
    }
  };
}
