import type { Entity, System, World } from "../../../core/ecs.js";
import { approach, type Vec3 } from "../../../core/math.js";
import { FIXED_DT } from "../../../core/time.js";
import { dodgeCost, walkPace } from "../../../items/burden.js";
import {
  ActiveHit, Body, Health, Player, Stamina, Statuses, type PlayerAction, type PlayerData, type StaminaData,
} from "../../components.js";
import { MAGIC } from "../../../spells/effects.js";
import { sameSpell, spellCost, type Spell, type Spellbook } from "../../../spells/spell.js";
import { PlayerInput, type PlayerInputData } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats, moveSpeed } from "../../stats.js";
import {
  attackShape, CHAIN, chainKind, isSwing, lettingGoAt, liveStep, MOMENTUM, momentumDamage, STARTER_SWORD, startupTime,
  type AttackKind,
} from "../../sword.js";
import { addHit, breakOff, endCombo } from "../combat.js";
import { statusMoveFactor } from "../spells/statuses.js";

/** Start an action toward (x, z), ending the last attack's hitbox if it's still live. */
function startAction(world: World, e: Entity, player: PlayerData, action: PlayerAction, x: number, z: number): void {
  world.remove(e, ActiveHit);
  if (player.action === "chant" || player.action === "write") player.chantBroken = true;
  player.casting = null;
  player.writing = null;
  player.action = action;
  player.actionTime = 0;
  player.actionDir = { x, z };
}

function spend(stamina: StaminaData, cost: number): void {
  stamina.value = Math.max(0, stamina.value - cost);
  stamina.regenDelay = PLAYER.staminaRegenDelay;
}

/**
 * Start `attack`: a swing chains when the last attack is still going or only just over, its start quicker or
 * slower by how it follows the last swing, and builds momentum; a stab chained after swings spends the momentum.
 */
function startAttack(world: World, e: Entity, player: PlayerData, input: PlayerInputData, attack: AttackKind): void {
  const chained = player.combo !== null && (player.action === "attack" || player.comboTime > 0);
  if (!chained) endCombo(player);
  if (isSwing(attack)) {
    const kind = chainKind(player.combo, attack);
    player.momentum = Math.min(MOMENTUM.max, player.momentum + MOMENTUM.gain[kind]);
    player.startup = startupTime(kind, player.momentum, STARTER_SWORD.speed);
    player.power = momentumDamage(player.momentum);
    player.combo = attack;
  } else {
    player.startup = CHAIN.stabStartupTime / STARTER_SWORD.speed;
    player.power = PLAYER.stab.damageFactor * (1 + player.momentum * MOMENTUM.stabBonusPerPoint);
    endCombo(player);
  }
  startAction(world, e, player, "attack", input.aimX, input.aimZ);
  player.attack = attack;
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

const onPage = (book: Spellbook, spell: Spell): boolean => book.some((page) => page !== null && sameSpell(page, spell));

/** Walk at `speed` while busy (swinging, blocking). */
function shuffle(input: PlayerInputData, v: Vec3, dt: number, speed: number): void {
  const accel = PLAYER.accel * dt;
  v.x = approach(v.x, input.moveX * speed, accel);
  v.z = approach(v.z, input.moveZ * speed, accel);
}

/**
 * Moves and actions. Only ever writes velocity (the physics moves the body). Attacks and the block go where the
 * player aims (the camera's facing, or the locked enemy); a dodge goes where they move, or backwards standing still.
 */
export function playerControllerSystem(): System {
  return (world, dt) => {
    for (const [e] of world.query(Player, PlayerInput, Body, Health, Stamina, FighterStats)) {
      controlPlayer(world, e, dt);
    }
  };
}

function controlPlayer(world: World, e: Entity, dt: number): void {
  const player = world.require(e, Player), input = world.require(e, PlayerInput), body = world.require(e, Body);
  const health = world.require(e, Health), stamina = world.require(e, Stamina), stats = world.require(e, FighterStats);
  const statuses = world.get(e, Statuses);
  const v = body.vel;
  const walkSpeed = moveSpeed(PLAYER.moveSpeed, stats) * walkPace(player.burden) * statusMoveFactor(statuses);
  const alive = health.hp > 0;

  // Presses are buffered, so a slightly early one still counts. During an attack, the buffer only runs down once the
  // attack lets go: a dodge or the next attack waits for it, however early it's pressed.
  const locked = player.action === "attack" && player.actionTime < lettingGoAt(player);
  const { sword, spellbook } = player.wields;
  const attackPressed = sword && input.attack !== null && input.attack !== player.attackHeld;
  const dodgePressed = input.dodge && !player.dodgeHeld;
  const castPressed = spellbook && input.cast !== null && !player.castHeld;
  if (attackPressed) {
    player.queued = input.attack;
    player.attackBuffer = PLAYER.inputBuffer;
  } else if (!locked) player.attackBuffer = Math.max(0, player.attackBuffer - dt);
  if (dodgePressed) player.dodgeBuffer = PLAYER.inputBuffer;
  else if (!locked) player.dodgeBuffer = Math.max(0, player.dodgeBuffer - dt);
  if (castPressed) {
    player.castQueued = input.cast;
    player.castBuffer = PLAYER.inputBuffer;
  } else if (!locked) player.castBuffer = Math.max(0, player.castBuffer - dt);
  const writePressed = input.write !== null && !player.writeHeld;
  player.attackHeld = input.attack;
  player.dodgeHeld = input.dodge;
  player.castHeld = input.cast !== null;
  player.writeHeld = input.write !== null;
  if (!input.chant) player.chantBroken = false;
  if (player.action !== "attack" && player.comboTime > 0) {
    player.comboTime -= dt;
    if (player.comboTime <= 0) endCombo(player);
  }

  if (!alive || health.hitstun > 0) {
    // Knocked back, staggered or dead: no control, slide to a stop on the ground.
    if (player.action !== "none" && player.action !== "stagger") {
      breakOff(player);
      world.remove(e, ActiveHit);
    }
    player.attackBuffer = player.dodgeBuffer = player.castBuffer = 0;
    if (player.grounded) {
      const slowdown = PLAYER.accel * 0.4 * dt;
      v.x = approach(v.x, 0, slowdown);
      v.z = approach(v.z, 0, slowdown);
    }
  } else {
    if (player.action === "stagger") player.action = "none";
    const dodge = PLAYER.dodge, burdenCost = dodgeCost(player.burden);
    const dodgeStamina = burdenCost === null ? null
      : burdenCost * ((statuses?.left.hasted ?? 0) > 0 ? MAGIC.self.air.dodgeCostFactor : 1);
    const free = player.action === "none" || player.action === "block" || (player.action === "attack" && !locked);
    const chanting = player.action === "chant" || player.action === "write";
    let queuedCast = player.castQueued;
    if (queuedCast !== null && player.action !== "chant" && !onPage(player.book, queuedCast)) {
      player.castQueued = queuedCast = null;
      player.castBuffer = 0;
    }
    const write = input.write;
    // A dodge cancels a cast's wind-up, which costs nothing until it's released.
    if ((free || chanting || player.action === "cast") && player.dodgeBuffer > 0 && dodgeStamina !== null
      && player.grounded
      && stamina.value > 0) {
      let dx = input.moveX, dz = input.moveZ;
      const len = Math.hypot(dx, dz);
      if (len < 0.2) { dx = -input.aimX; dz = -input.aimZ; } // backstep
      else { dx /= len; dz /= len; }
      startAction(world, e, player, "dodge", dx, dz);
      spend(stamina, dodgeStamina);
      player.dodgeBuffer = 0;
      endCombo(player);
    } else if ((free || player.action === "chant") && player.castBuffer > 0 && queuedCast !== null
      && stamina.value >= spellCost(queuedCast)) {
      startAction(world, e, player, "cast", input.aimX, input.aimZ);
      player.casting = queuedCast;
      player.castBuffer = 0;
      endCombo(player);
    } else if (player.action === "chant" && writePressed && write && write.page < player.book.length) {
      player.action = "write";
      player.actionTime = 0;
      player.writing = write;
    } else if (chanting && !input.chant) {
      player.action = "none";
      player.writing = null;
    } else if (free && spellbook && input.chant && !player.chantBroken) {
      startAction(world, e, player, "chant", input.aimX, input.aimZ);
      endCombo(player);
    } else if (free && player.attackBuffer > 0 && player.queued !== null && stamina.value > 0) {
      startAttack(world, e, player, input, player.queued);
      spend(stamina, isSwing(player.queued) ? PLAYER.swing.cost : PLAYER.stab.cost);
      player.attackBuffer = 0;
    } else if (player.action === "none" && sword && input.block && player.grounded) {
      startAction(world, e, player, "block", input.aimX, input.aimZ);
      endCombo(player);
    }

    const t = player.actionTime, dir = player.actionDir;
    switch (player.action) {
      case "attack": {
        const stab = !isSwing(player.attack), move = stab ? PLAYER.stab : PLAYER.swing;
        // The step into the attack: its blade is live from `liveStep` for the active time.
        const step = Math.round(t / FIXED_DT), live = liveStep(player.startup);
        if (step >= live && step < live + liveStep(CHAIN.activeTime)) {
          if (!world.has(e, ActiveHit)) {
            addHit(world, e, dir.x, dir.z, {
              ...attackShape(player.attack, STARTER_SWORD), damage: STARTER_SWORD.damage * player.power,
              poiseDamage: move.poiseDamage, attack: player.attack,
            });
          }
          v.x = dir.x * move.lungeSpeed;
          v.z = dir.z * move.lungeSpeed;
        } else {
          world.remove(e, ActiveHit);
          shuffle(input, v, dt, walkSpeed * PLAYER.swing.moveFactor);
        }
        if (t >= player.startup + CHAIN.activeTime + CHAIN.recoverTime) {
          player.action = "none";
          if (player.combo !== null) player.comboTime = CHAIN.gapTime;
        }
        break;
      }
      case "block":
        player.actionDir = { x: input.aimX, z: input.aimZ };
        shuffle(input, v, dt, walkSpeed * PLAYER.block.moveFactor);
        if (!input.block) player.action = "none";
        break;
      case "dodge": {
        const progress = Math.min(1, t / dodge.duration);
        const speed = dodge.speed + (dodge.endSpeed - dodge.speed) * progress * progress;
        v.x = dir.x * speed;
        v.z = dir.z * speed;
        if (t >= dodge.duration) player.action = "none";
        break;
      }
      case "cast":
        shuffle(input, v, dt, walkSpeed * MAGIC.castMoveFactor);
        break;
      case "chant":
      case "write":
        v.x = approach(v.x, 0, PLAYER.accel * dt);
        v.z = approach(v.z, 0, PLAYER.accel * dt);
        break;
      case "none":
        locomotion(player, input, v, dt, walkSpeed);
        break;
    }
    player.actionTime += dt;
  }
  player.jumpHeld = input.jump;

  // Stamina: paused during actions (blocking too, not chanting), regenerates after a short delay.
  if (player.action !== "none" && player.action !== "chant" && player.action !== "write") {
    stamina.regenDelay = PLAYER.staminaRegenDelay;
  }
  else if (stamina.regenDelay > 0) stamina.regenDelay -= dt;
  else {
    const charged = (statuses?.left.charged ?? 0) > 0 ? MAGIC.self.lightning.staminaRegenFactor : 1;
    stamina.value = Math.min(stamina.max, stamina.value + PLAYER.staminaRegenPerSec * charged * dt);
  }
}
