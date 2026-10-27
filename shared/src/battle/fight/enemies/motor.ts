/** Turns each enemy's wanted movement (Enemy.move) into velocity. Runs last, before the physics step. */
import type { System } from "../../../core/ecs.js";
import { approach } from "../../../core/math.js";
import { Body, Enemy } from "../../components.js";

export function enemyMotorSystem(): System {
  return (world, dt) => {
    for (const [, enemy, body] of world.query(Enemy, Body)) {
      const v = body.vel, m = enemy.move;
      if (m.halt) v.x = v.z = 0;
      v.x = approach(v.x, m.dirX * m.speed, m.accel * dt);
      v.z = approach(v.z, m.dirZ * m.speed, m.accel * dt);
    }
  };
}
