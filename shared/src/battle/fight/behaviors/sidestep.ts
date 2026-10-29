import type { System } from "../../../core/ecs.js";
import { FIXED_DT } from "../../../core/time.js";
import { releaseTime } from "../../../skills/skill.js";
import { Body, Enemy, Fighter, Sidestep, Skilled } from "../../components.js";
import type { FightContext } from "../context.js";
import { enter, roll } from "./common.js";

/** The caster's aim counts as at the enemy within this cos of the angle. */
const AIM_MIN_DOT = 0.9;
const STEP_ACCEL = 60;

const stepsOf = (seconds: number): number => Math.round(seconds / FIXED_DT);

export function sidestepSystem(ctx: Pick<FightContext, "arena">): System {
  return (world) => {
    for (const [e, sidestep, enemy, body] of world.query(Sidestep, Enemy, Body)) {
      const def = sidestep.def, move = enemy.move;
      if (enemy.state === "sidestep" && enemy.stateTime >= def.stepTime) enter(world, e, enemy, "approach");
      const ownSide = world.require(e, Fighter).side;
      for (const [, caster, from, { side: casterSide }] of world.query(Skilled, Body, Fighter)) {
        const skill = caster.casting;
        if (enemy.state !== "approach" || casterSide === ownSide || skill?.segments[0].form !== "bolt") continue;
        if (stepsOf(caster.castTime) !== stepsOf(Math.max(def.reactTime, releaseTime(skill) - def.leadTime))) continue;
        const dx = body.pos.x - from.pos.x, dz = body.pos.z - from.pos.z, dist = Math.hypot(dx, dz);
        if (dist === 0 || (dx * caster.aim.x + dz * caster.aim.z) / dist < AIM_MIN_DOT) continue;
        if (roll(enemy) >= def.chance) continue;
        const side = roll(enemy) < 0.5 ? 1 : -1, reachM = def.speed * def.stepTime;
        sidestep.dir = { x: (side * dz) / dist, z: (-side * dx) / dist };
        const end = { x: body.pos.x + sidestep.dir.x * reachM, z: body.pos.z + sidestep.dir.z * reachM };
        if (Math.hypot(end.x, end.z) > ctx.arena.radius - enemy.def.radius) {
          sidestep.dir = { x: -sidestep.dir.x, z: -sidestep.dir.z };
        }
        enter(world, e, enemy, "sidestep");
      }
      if (enemy.state === "sidestep") {
        move.dirX = sidestep.dir.x; move.dirZ = sidestep.dir.z; move.speed = def.speed; move.accel = STEP_ACCEL;
      }
    }
  };
}
