import { PhysicsRaycastResult, Vector3 } from "@babylonjs/core";
import { Player, PLAYER, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import { Layer, type BattleContext } from "../context.js";

/** After each physics step: cast a few short rays down from the feet to decide `grounded`. */
export function playerGroundSystem(ctx: BattleContext): System {
  const result = new PhysicsRaycastResult();
  const from = new Vector3(), to = new Vector3(), vel = new Vector3();
  const r = PLAYER.radius * 0.7;
  const offsets = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] as const;

  return (world, dt) => {
    for (const [, player, body] of world.query(Player, Body)) {
      const b = body.aggregate.body;
      const p = body.mesh.position;
      b.getLinearVelocityToRef(vel);

      let hit = false;
      if (vel.y <= 0.5) {
        for (const [ox, oz] of offsets) {
          from.set(p.x + ox, p.y, p.z + oz);
          to.set(from.x, p.y - PLAYER.height / 2 - 0.08, from.z);
          ctx.physics.raycastToRef(from, to, result, { collideWith: Layer.Ground, ignoreBody: b });
          if (result.hasHit) { hit = true; break; }
        }
      }
      player.grounded = hit;
      player.airTime = hit ? 0 : player.airTime + dt;
    }
  };
}
