/** Turns each enemy's wanted movement (Enemy.move) into Havok velocity. Runs last, before physics. */
import { Vector3 } from "@babylonjs/core";
import { approach, Enemy, type System } from "@infinite-tower/shared";
import { Body } from "../../components.js";

export function enemyMotorSystem(): System {
  const v = new Vector3();
  return (world, dt) => {
    for (const [, enemy, body] of world.query(Enemy, Body)) {
      const b = body.aggregate.body, m = enemy.move;
      b.getLinearVelocityToRef(v);
      if (m.halt) v.x = v.z = 0;
      v.x = approach(v.x, m.dirX * m.speed, m.accel * dt);
      v.z = approach(v.z, m.dirZ * m.speed, m.accel * dt);
      b.setLinearVelocity(v);
    }
  };
}
