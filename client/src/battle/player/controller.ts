import { Vector3 } from "@babylonjs/core";
import {
  approach, ActiveHit, Health, Player, PlayerInput, Stamina, PLAYER,
  type PlayerAction, type PlayerData, type PlayerInputData, type StaminaData, type System,
} from "@infinite-tower/shared";
import { Body } from "../components.js";
import { Layer } from "../context.js";

function startAction(player: PlayerData, action: PlayerAction, x: number, z: number): void {
  player.action = action;
  player.actionTime = 0;
  player.actionDir = { x, z };
}

function spend(stamina: StaminaData, cost: number): void {
  stamina.value = Math.max(0, stamina.value - cost);
  stamina.regenDelay = PLAYER.staminaDelay;
}

/** Free movement + jump (with buffering, coyote time and variable height). */
function locomotion(player: PlayerData, input: PlayerInputData, v: Vector3, dt: number, speedFactor = 1): void {
  let ix = input.moveX, iz = input.moveZ;
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const accel = (player.grounded ? PLAYER.accel : PLAYER.airAccel) * dt;
  v.x = approach(v.x, ix * PLAYER.moveSpeed * speedFactor, accel);
  v.z = approach(v.z, iz * PLAYER.moveSpeed * speedFactor, accel);

  const pressed = input.jump && !player.jumpHeld;
  player.jumpBuffer = pressed ? PLAYER.jumpBuffer : Math.max(0, player.jumpBuffer - dt);
  const canJump = player.grounded || player.airTime < PLAYER.coyoteTime;
  if (player.jumpBuffer > 0 && canJump) {
    v.y = PLAYER.jumpSpeed;
    player.jumpBuffer = 0;
    player.grounded = false;
    player.airTime = PLAYER.coyoteTime; // no second coyote jump
  }
  if (!input.jump && player.jumpHeld && v.y > 0) v.y *= PLAYER.jumpCutMultiplier;
}

/**
 * Player controller + combat actions. Runs before each physics step and only ever writes velocity
 * (Havok owns the position). Slash goes where the player aims (the camera's facing); dodge goes
 * where they move, or backwards if standing still.
 */
export function playerControllerSystem(): System {
  const v = new Vector3();
  return (world, dt) => {
    for (const [e, player, input, body, health, stamina] of world.query(Player, PlayerInput, Body, Health, Stamina)) {
      const b = body.aggregate.body;
      b.getLinearVelocityToRef(v);
      const alive = health.hp > 0;

      // Edge-detect presses and buffer them, so a press slightly early still counts.
      player.attackBuffer = input.attack && !player.attackHeld ? PLAYER.inputBuffer : Math.max(0, player.attackBuffer - dt);
      player.dodgeBuffer = input.dodge && !player.dodgeHeld ? PLAYER.inputBuffer : Math.max(0, player.dodgeBuffer - dt);
      player.attackHeld = input.attack;
      player.dodgeHeld = input.dodge;

      if (!alive || health.hitstun > 0) {
        // Knocked back or dead: no control, slide to a stop on the ground.
        if (player.action !== "none") { player.action = "none"; world.remove(e, ActiveHit); }
        player.attackBuffer = player.dodgeBuffer = 0;
        if (player.grounded) {
          const f = PLAYER.accel * 0.4 * dt;
          v.x = approach(v.x, 0, f);
          v.z = approach(v.z, 0, f);
        }
      } else {
        const S = PLAYER.slash, D = PLAYER.dodge;
        const free = player.action === "none" || (player.action === "slash" && player.actionTime >= S.chainAfter);
        if (free && player.dodgeBuffer > 0 && player.grounded && stamina.value > 0) {
          let dx = input.moveX, dz = input.moveZ;
          const len = Math.hypot(dx, dz);
          if (len < 0.2) { dx = -input.aimX; dz = -input.aimZ; } // backstep
          else { dx /= len; dz /= len; }
          world.remove(e, ActiveHit);
          startAction(player, "dodge", dx, dz);
          spend(stamina, D.cost);
          player.dodgeBuffer = 0;
        } else if (free && player.attackBuffer > 0 && stamina.value > 0) {
          world.remove(e, ActiveHit);
          startAction(player, "slash", input.aimX, input.aimZ);
          player.combo++;
          spend(stamina, S.cost);
          player.attackBuffer = 0;
        }

        const t = player.actionTime, d = player.actionDir;
        switch (player.action) {
          case "slash": {
            if (t >= S.windup && t < S.windup + S.active) {
              // Active frames: the hitbox exists and the swing carries you forward a little.
              if (!world.has(e, ActiveHit)) {
                world.add(e, ActiveHit, {
                  dirX: d.x, dirZ: d.z, range: S.range, minDot: S.minDot,
                  damage: S.damage, knockback: 0, lift: 0, poise: S.poise, hit: new Set<number>(),
                });
              }
              v.x = d.x * S.lunge;
              v.z = d.z * S.lunge;
            } else {
              world.remove(e, ActiveHit);
              const max = PLAYER.moveSpeed * S.moveFactor, a = PLAYER.accel * dt;
              v.x = approach(v.x, input.moveX * max, a);
              v.z = approach(v.z, input.moveZ * max, a);
            }
            if (t >= S.duration) player.action = "none";
            break;
          }
          case "dodge": {
            const k = Math.min(1, t / D.duration);
            const speed = D.speed + (D.endSpeed - D.speed) * k * k;
            v.x = d.x * speed;
            v.z = d.z * speed;
            if (t >= D.duration) player.action = "none";
            break;
          }
          case "none":
            locomotion(player, input, v, dt);
            break;
        }
        player.actionTime += dt;
      }
      player.jumpHeld = input.jump;

      // Stamina: paused during actions, regenerates after a short delay.
      if (player.action !== "none") stamina.regenDelay = PLAYER.staminaDelay;
      else if (stamina.regenDelay > 0) stamina.regenDelay -= dt;
      else stamina.value = Math.min(stamina.max, stamina.value + PLAYER.staminaRegen * dt);

      b.setLinearVelocity(v);

      // Pass through enemies while dodging, knocked back or dead.
      const solidToEnemies = alive && player.action !== "dodge" && health.hitstun <= 0;
      const mask = Layer.Ground | Layer.Wall | (solidToEnemies ? Layer.Enemy : 0);
      if (body.aggregate.shape.filterCollideMask !== mask) body.aggregate.shape.filterCollideMask = mask;
    }
  };
}
