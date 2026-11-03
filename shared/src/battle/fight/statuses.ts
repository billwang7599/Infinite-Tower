import type { System } from "../../core/ecs.js";
import { REACTIONS, type Reaction } from "../../skills/effects.js";
import { Health, Statuses, type StatusData } from "../components.js";
import { modsFrom, statusDef } from "../statuses.js";
import { heal, hurt } from "./health.js";

export function noStatuses(): StatusData {
  return { on: [], cooldown: Object.fromEntries(REACTIONS.map((r) => [r, 0])) as Record<Reaction, number> };
}

export function statusSystem(): System {
  return (world, dt) => {
    for (const [e, s, health] of world.query(Statuses, Health)) {
      const burnTaken = modsFrom(s.on).burnTakenFactor;
      for (const o of [...s.on]) {
        const kind = statusDef(o.status).amount;
        if (kind === "hurtsPerSec" && health.hp > 0 && burnTaken > 0) {
          hurt(world, e, o.amount * dt * burnTaken, "skill");
        }
        if (kind === "healsPerSec") heal(world, e, o.amount * dt);
      }
      s.on = s.on.filter((o) => {
        if (o.left !== null) o.left = Math.max(0, o.left - dt);
        return o.left !== 0;
      });
      for (const reaction of REACTIONS) s.cooldown[reaction] = Math.max(0, s.cooldown[reaction] - dt);
    }
  };
}
