import type { Entity, System, World } from "../../../core/ecs.js";
import { approach, type Vec3 } from "../../../core/math.js";
import { dodgeCost, walkPace } from "../../../items/burden.js";
import {
  ActiveHit, Body, Health, Player, Stamina, type PlayerAction, type PlayerData, type StaminaData,
} from "../../components.js";
import { PlayerInput, type PlayerInputData } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats, moveSpeed } from "../../stats.js";
import { addHit } from "../combat.js";

/** Start a slash or dodge toward (x, z), ending the last slash's hitbox if it's still live. */
function startAction(world: World, e: Entity, player: PlayerData, action: PlayerAction, x: number, z: number): void {
  world.remove(e, ActiveHit);
  player.action = action;
  player.actionTime = 0;
  player.actionDir = { x, z };
}

function spend(stamina: StaminaData, cost: number): void {
  stamina.value = Math.max(0, stamina.value - cost);
  stamina.regenDelay = PLAYER.staminaRegenDelay;
}

/** Free movement + jump (with buffering, coyote time and variable height). `speed`: full speed, from agility. */
function locomotion(player: PlayerData, input: PlayerInputData, v: Vec3, dt: number, speed: number): void {
  let ix = input.moveX, iz = input.moveZ;
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const accel = (player.grounded ? PLAYER.accel : PLAYER.airAccel) * dt;
  v.x = approach(v.x, ix * speed, accel);
  v.z = approach(v.z, iz * speed, accel);

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
 * Player controller + combat actions. Runs before the physics step and only ever writes velocity (the physics
 * moves the body). Slash goes where the player aims (the camera's facing); dodge goes where they move, or backwards
 * if standing still. A heavy bag makes the dodge cost more; an overloaded one rules it out and halves the walking
 * speed (items/burden.ts).
 */
export function playerControllerSystem(): System {
  return (world, dt) => {
    for (const [e] of world.query(Player, PlayerInput, Body, Health, Stamina, FighterStats)) {
      controlPlayer(world, e, dt);
    }
  };
}

/** One step of player `e`'s controller. */
export function controlPlayer(world: World, e: Entity, dt: number): void {
  const player = world.require(e, Player), input = world.require(e, PlayerInput), body = world.require(e, Body);
  const health = world.require(e, Health), stamina = world.require(e, Stamina), stats = world.require(e, FighterStats);
  const v = body.vel;
  const walkSpeed = moveSpeed(PLAYER.moveSpeed, stats) * walkPace(player.burden);
  const alive = health.hp > 0;

  // Edge-detect presses and buffer them, so a press slightly early still counts. A dodge waits out a slash however
  // early in it it's pressed (the user's call): its buffer only starts running down once the slash lets go.
  const slash = PLAYER.slash;
  const slashLocked = player.action === "slash" && player.actionTime < slash.chainAfter;
  const attackPressed = input.attack && !player.attackHeld, dodgePressed = input.dodge && !player.dodgeHeld;
  player.attackBuffer = attackPressed ? PLAYER.inputBuffer : Math.max(0, player.attackBuffer - dt);
  if (dodgePressed) player.dodgeBuffer = PLAYER.inputBuffer;
  else if (!slashLocked) player.dodgeBuffer = Math.max(0, player.dodgeBuffer - dt);
  player.attackHeld = input.attack;
  player.dodgeHeld = input.dodge;

  if (!alive || health.hitstun > 0) {
    // Knocked back or dead: no control, slide to a stop on the ground.
    if (player.action !== "none") { player.action = "none"; world.remove(e, ActiveHit); }
    player.attackBuffer = player.dodgeBuffer = 0;
    if (player.grounded) {
      const slowdown = PLAYER.accel * 0.4 * dt;
      v.x = approach(v.x, 0, slowdown);
      v.z = approach(v.z, 0, slowdown);
    }
  } else {
    const dodge = PLAYER.dodge, dodgeStamina = dodgeCost(player.burden);
    const free = player.action === "none" || (player.action === "slash" && !slashLocked);
    if (free && player.dodgeBuffer > 0 && dodgeStamina !== null && player.grounded && stamina.value > 0) {
      let dx = input.moveX, dz = input.moveZ;
      const len = Math.hypot(dx, dz);
      if (len < 0.2) { dx = -input.aimX; dz = -input.aimZ; } // backstep
      else { dx /= len; dz /= len; }
      startAction(world, e, player, "dodge", dx, dz);
      spend(stamina, dodgeStamina);
      player.dodgeBuffer = 0;
    } else if (free && player.attackBuffer > 0 && stamina.value > 0) {
      startAction(world, e, player, "slash", input.aimX, input.aimZ);
      spend(stamina, slash.cost);
      player.attackBuffer = 0;
    }

    const t = player.actionTime, dir = player.actionDir;
    switch (player.action) {
      case "slash": {
        if (t >= slash.windup && t < slash.windup + slash.active) {
          // Active frames: the hitbox exists and the swing carries you forward a little.
          if (!world.has(e, ActiveHit)) addHit(world, e, dir.x, dir.z, slash);
          v.x = dir.x * slash.lungeSpeed;
          v.z = dir.z * slash.lungeSpeed;
        } else {
          world.remove(e, ActiveHit);
          const maxSpeed = walkSpeed * slash.moveFactor, accel = PLAYER.accel * dt;
          v.x = approach(v.x, input.moveX * maxSpeed, accel);
          v.z = approach(v.z, input.moveZ * maxSpeed, accel);
        }
        if (t >= slash.duration) player.action = "none";
        break;
      }
      case "dodge": {
        const progress = Math.min(1, t / dodge.duration);
        const speed = dodge.speed + (dodge.endSpeed - dodge.speed) * progress * progress;
        v.x = dir.x * speed;
        v.z = dir.z * speed;
        if (t >= dodge.duration) player.action = "none";
        break;
      }
      case "none":
        locomotion(player, input, v, dt, walkSpeed);
        break;
    }
    player.actionTime += dt;
  }
  player.jumpHeld = input.jump;

  // Stamina: paused during actions, regenerates after a short delay.
  if (player.action !== "none") stamina.regenDelay = PLAYER.staminaRegenDelay;
  else if (stamina.regenDelay > 0) stamina.regenDelay -= dt;
  else stamina.value = Math.min(stamina.max, stamina.value + PLAYER.staminaRegenPerSec * dt);
}
