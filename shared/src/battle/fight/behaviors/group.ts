// Worked out afresh from the foes' states each step, so nothing here is saved.
import type { Entity, System, World } from "../../../core/ecs.js";
import { clamp } from "../../../core/math.js";
import { Body, Enemy, Health, WeaponAttack, type EnemyData, type EnemyState } from "../../components.js";
import { FighterStats, moveSpeed } from "../../stats.js";
import { aimOf } from "../aim.js";

export const GROUP = {
  maxAttackers: 2,
  /** Out of every melee reach. */
  holdM: 4.5,
  /** Between bodies. */
  spacingM: 1,
  /** Waiting foes come within this cos of the player's facing. */
  inViewDot: Math.cos((55 * Math.PI) / 180),
  /** A foe that has just attacked lets a longer-waiting one go first, this long. */
  restTime: 1.5,
} as const;

const WAITING = new Set<EnemyState>(["approach", "stunned", "staggered", "dead", "sidestep"]);
const WINDUPS = new Set<EnemyState>([
  "lungeWindup", "chargeWindup", "pounceWindup", "slamWindup", "sweepWindup", "weaponWindup", "skillChant",
]);
const HOLD_BAND_M = 1;
const DRIFT_FACTOR = 0.6;
const VIEW_MARGIN = 0.15;

interface Other { enemy: EnemyData; chaining: boolean }

function othersOnTarget(world: World, e: Entity, target: Entity): Other[] {
  return [...world.query(Enemy)].filter(([o, other]) => o !== e && other.sense.target === target)
    .map(([o, enemy]) => ({
      enemy, chaining: !WAITING.has(enemy.state) && (world.get(o, WeaponAttack)?.swingsLeft ?? 0) > 0,
    }));
}

const attackers = (others: Other[]) => others.filter((o) => !WAITING.has(o.enemy.state)).length;

export function mayStart(world: World, e: Entity, enemy: EnemyData): boolean {
  const target = enemy.sense.target;
  if (target === null) return false;
  const others = othersOnTarget(world, e, target);
  // A swordsman with chained swings still to come will wind up again: its turn to tell isn't over.
  if (attackers(others) >= GROUP.maxAttackers || others.some((o) => o.chaining || WINDUPS.has(o.enemy.state))) {
    return false;
  }
  return enemy.stateTime >= GROUP.restTime
    || !others.some((o) => o.enemy.state === "approach" && o.enemy.stateTime > enemy.stateTime);
}

export function groupSystem(): System {
  return (world) => {
    const foes = [...world.query(Enemy, Body, Health, FighterStats)];
    for (const [e, enemy, body, , stats] of foes) {
      const target = enemy.sense.target, move = enemy.move;
      if (enemy.state !== "approach" || !enemy.sense.targetAlive || target === null) continue;
      const walk = moveSpeed(enemy.def.walkSpeed, stats), p = body.pos;
      let vx = move.dirX * move.speed, vz = move.dirZ * move.speed;

      if (attackers(othersOnTarget(world, e, target)) >= GROUP.maxAttackers) {
        const t = world.require(target, Body).pos, dist = enemy.sense.dist || 1e-6;
        const outX = (p.x - t.x) / dist, outZ = (p.z - t.z) / dist;
        const holdM = Math.max(GROUP.holdM, enemy.def.keepAway?.farM ?? 0);
        const outward = clamp((holdM - dist) / HOLD_BAND_M, -1, 1) * walk;
        const view = aimOf(world, target).dir, seen = outX * view.x + outZ * view.z;
        const side = Math.sign(view.x * outZ - view.z * outX) || 1;
        const drift = clamp((GROUP.inViewDot + VIEW_MARGIN - seen) * 3, 0, 1) * walk * DRIFT_FACTOR;
        vx = outX * outward + side * outZ * drift;
        vz = outZ * outward - side * outX * drift;
      }

      const radius = enemy.def.radius;
      for (const [o, other, ob, health] of foes) {
        if (o === e || health.hp <= health.floor) continue;
        const dx = p.x - ob.pos.x, dz = p.z - ob.pos.z, d = Math.hypot(dx, dz) || 1e-6;
        const crowd = 1 - (d - radius - other.def.radius) / GROUP.spacingM;
        if (crowd > 0) { vx += (dx / d) * Math.min(crowd, 1) * walk; vz += (dz / d) * Math.min(crowd, 1) * walk; }
      }
      const speed = Math.hypot(vx, vz), most = Math.max(walk, Math.abs(move.speed));
      if (speed > 1e-6) Object.assign(move, { dirX: vx / speed, dirZ: vz / speed, speed: Math.min(speed, most) });
    }
  };
}
