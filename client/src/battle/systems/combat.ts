import { Vector3 } from "@babylonjs/core";
import {
  ActiveHit, Enemy, Fighter, Health, LocalPlayer, Player, PLAYER, type System,
} from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { GameContext } from "../context.js";

/**
 * After each physics step: resolve every active hitbox against every fighter of the other team.
 * Hitboxes are sectors (range + angle) checked with plain math, not physics triggers: cheap,
 * deterministic and identical on a future server.
 */
export function combatSystem(ctx: GameContext): System {
  const knock = new Vector3();
  return (world, dt) => {
    for (const [, h] of world.query(Health)) {
      h.invuln = Math.max(0, h.invuln - dt);
      h.hitstun = Math.max(0, h.hitstun - dt);
      h.flash = Math.max(0, h.flash - dt);
    }

    for (const [, hit, ab, af] of world.query(ActiveHit, Body, Fighter)) {
      const ap = ab.mesh.position;
      for (const [target, th, tb, tf] of world.query(Health, Body, Fighter)) {
        if (tf.team === af.team || th.hp <= 0 || th.invuln > 0 || hit.hit.has(target)) continue;
        const player = world.get(target, Player);
        // Dodge i-frames.
        if (player?.action === "dodge"
          && player.actionTime >= PLAYER.dodge.iframeStart && player.actionTime < PLAYER.dodge.iframeEnd) continue;

        const q = tb.mesh.position;
        const dx = q.x - ap.x, dz = q.z - ap.z;
        const d = Math.hypot(dx, dz);
        if (d - tf.radius > hit.range) continue;
        if (d > 0.3 && (dx * hit.dirX + dz * hit.dirZ) / d < hit.minDot) continue;

        hit.hit.add(target);
        th.hp = Math.max(0, th.hp - hit.damage);
        th.flash = 0.12;

        if (player) {
          // Player got hit: knocked back (along the attack, pushed away from the attacker), brief loss of control.
          th.invuln = PLAYER.hurtInvuln;
          th.hitstun = 0.25 + hit.knockback * 0.02;
          let kx = hit.dirX * 0.5 + (d > 0.01 ? dx / d : hit.dirX) * 0.5;
          let kz = hit.dirZ * 0.5 + (d > 0.01 ? dz / d : hit.dirZ) * 0.5;
          const kl = Math.hypot(kx, kz) || 1;
          kx /= kl; kz /= kl;
          tb.aggregate.body.setLinearVelocity(knock.set(kx * hit.knockback, hit.lift, kz * hit.knockback));
          ctx.shake = Math.max(ctx.shake, 0.15 + hit.damage * 0.008);
        } else {
          const enemy = world.get(target, Enemy);
          if (enemy) enemy.poise -= hit.poise;
          ctx.shake = Math.max(ctx.shake, 0.06);
        }
      }
    }

    const fight = ctx.fight;
    if (fight.state === "fighting") {
      fight.time += dt;
      const me = world.first(LocalPlayer, Health);
      let enemiesLeft = false;
      for (const [, f, h] of world.query(Fighter, Health)) if (f.team === "enemy" && h.hp > 0) enemiesLeft = true;
      if (me && me[2].hp <= 0) { fight.state = "lost"; fight.time = 0; }
      else if (!enemiesLeft) { fight.state = "won"; fight.time = 0; }
    } else {
      fight.time += dt;
    }
  };
}
