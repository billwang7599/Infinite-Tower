import type { Entity, System, World } from "../../../core/ecs.js";
import { approach, type Vec3 } from "../../../core/math.js";
import { dodgeCost, walkPace } from "../../../items/burden.js";
import { emptyCloth, heldIn, moveGear } from "../../../items/gear.js";
import {
  Body, Health, Player, Skilled, Stamina, Statuses, Wielder, type PlayerAction, type PlayerData, type StaminaData,
  type WielderData,
} from "../../components.js";
import { SKILL_EFFECTS, shotOf } from "../../../skills/effects.js";
import { sameSkill, skillCost, type Skill, type Skillbook } from "../../../skills/skill.js";
import { PlayerInput, type PlayerInputData } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats, moveSpeed } from "../../stats.js";
import { CHAIN, isSwing, weaponIn, type AttackKind, type Weapon } from "../../../weapons/weapons.js";
import { breakOff } from "../combat.js";
import { imbueOf } from "../skills/cast.js";
import { endCast, startCast } from "../skills/skilled.js";
import { statusMoveFactor } from "../skills/statuses.js";
import { bladeLive, chainedSwing, chainOn, endChain, endSwing, handsOf, startSwing } from "../weapons/swing.js";

function startAction(world: World, e: Entity, player: PlayerData, action: PlayerAction, x: number, z: number): void {
  endSwing(world, e);
  if (player.action === "chant" || player.action === "write" || player.action === "bag") player.brokenOff = true;
  if (action !== "cast") endCast(world.require(e, Skilled));
  player.writing = null;
  player.action = action;
  player.actionTime = 0;
  player.actionDir = { x, z };
}

function spend(stamina: StaminaData, cost: number): void {
  stamina.value = Math.max(0, stamina.value - cost);
  stamina.regenDelay = PLAYER.staminaRegenDelay;
}

function startAttack(
  world: World, e: Entity, player: PlayerData, wielder: WielderData, weapon: Weapon, input: PlayerInputData,
  attack: AttackKind,
): void {
  const chained = wielder.combo !== null && (player.action === "attack" || wielder.comboTime > 0);
  let { startup, power } = chainOn(wielder, weapon, attack, chained, PLAYER.stab.damageFactor);
  const imbue = imbueOf(world, e)?.[1];
  if (imbue) startup /= shotOf(imbue.skill.segments[imbue.segment]!).swiftFactor;
  startAction(world, e, player, "attack", input.aimX, input.aimZ);
  const move = isSwing(attack) ? PLAYER.swing : PLAYER.stab;
  startSwing(world, e, chainedSwing(attack, { x: input.aimX, z: input.aimZ }, startup, {
    damage: weapon.damage * power, knockback: 0, lift: 0, poiseDamage: move.poiseDamage,
  }));
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

const onPage = (book: Skillbook, skill: Skill): boolean => book.some((page) => page !== null && sameSkill(page, skill));

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
export function playerControllerSystem(enemies: readonly Entity[]): System {
  return (world, dt) => {
    for (const [e] of world.query(Player, PlayerInput, Body, Health, Stamina, FighterStats, Wielder, Skilled)) {
      controlPlayer(world, e, dt, enemies);
    }
  };
}

function controlPlayer(world: World, e: Entity, dt: number, enemies: readonly Entity[]): void {
  const player = world.require(e, Player), input = world.require(e, PlayerInput), body = world.require(e, Body);
  const health = world.require(e, Health), stamina = world.require(e, Stamina), stats = world.require(e, FighterStats);
  const statuses = world.get(e, Statuses), wielder = world.require(e, Wielder), skilled = world.require(e, Skilled);
  const v = body.vel;
  const walkSpeed = moveSpeed(PLAYER.moveSpeed, stats) * walkPace(player.burden) * statusMoveFactor(statuses);
  const alive = health.hp > 0;

  // Presses are buffered, so a slightly early one still counts. During an attack, the buffer only runs down once the
  // attack lets go: a dodge or the next attack waits for it, however early it's pressed.
  const locked = wielder.swing !== null && wielder.swing.step < wielder.swing.letGoAt;
  const weapon = weaponIn(wielder.hands), skillbook = heldIn(wielder.hands, "skillbook") !== null;
  const attackPressed = weapon !== null && input.attack !== null && input.attack !== player.attackHeld;
  const dodgePressed = input.dodge && !player.dodgeHeld;
  const castPressed = input.cast !== null && !skilled.held;
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
  const gearPressed = input.gear !== null && !player.gearHeld;
  if (input.chantWords !== null && !player.wordsHeld) skilled.words = [...input.chantWords];
  player.attackHeld = input.attack;
  player.dodgeHeld = input.dodge;
  skilled.held = input.cast !== null || input.castHeld;
  player.writeHeld = input.write !== null;
  player.gearHeld = input.gear !== null;
  player.wordsHeld = input.chantWords !== null;
  skilled.aim = { x: input.aimX, z: input.aimZ };
  skilled.target = input.locked === null ? null : enemies[input.locked] ?? null;
  if (!input.chant && !input.bag) player.brokenOff = false;
  if (player.action !== "attack" && wielder.comboTime > 0) {
    wielder.comboTime -= dt;
    if (wielder.comboTime <= 0) endChain(wielder);
  }

  if (!alive || health.hitstun > 0) {
    // Knocked back, staggered or dead: no control, slide to a stop on the ground.
    if (player.action !== "none" && player.action !== "stagger") {
      breakOff(player, skilled);
      endSwing(world, e);
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
      : burdenCost * ((statuses?.left.hasted ?? 0) > 0 ? SKILL_EFFECTS.self.air.dodgeCostFactor : 1);
    const free = player.action === "none" || player.action === "block" || (player.action === "attack" && !locked);
    const chanting = player.action === "chant" || player.action === "write";
    const inBag = player.action === "bag";
    let queuedCast = player.castQueued;
    if (queuedCast !== null && player.action !== "chant" && !(skillbook && onPage(player.book, queuedCast))) {
      player.castQueued = queuedCast = null;
      player.castBuffer = 0;
    }
    const write = input.write;
    // A dodge cancels a cast's wind-up, which costs nothing until it's released, and ends a Beam.
    const dodgeable = free || chanting || inBag || player.action === "cast" || player.action === "beam";
    if (dodgeable && player.dodgeBuffer > 0 && dodgeStamina !== null && player.grounded && stamina.value > 0) {
      let dx = input.moveX, dz = input.moveZ;
      const len = Math.hypot(dx, dz);
      if (len < 0.2) { dx = -input.aimX; dz = -input.aimZ; } // backstep
      else { dx /= len; dz /= len; }
      startAction(world, e, player, "dodge", dx, dz);
      spend(stamina, dodgeStamina);
      player.dodgeBuffer = 0;
      endChain(wielder);
    } else if ((free || player.action === "chant") && player.castBuffer > 0 && queuedCast !== null
      && stamina.value >= skillCost(queuedCast)) {
      startCast(world, e, queuedCast);
      startAction(world, e, player, "cast", input.aimX, input.aimZ);
      player.castBuffer = 0;
      endChain(wielder);
    } else if (skillbook && (player.action === "chant" || inBag) && writePressed && write
      && write.page < player.book.length) {
      player.action = "write";
      player.actionTime = 0;
      player.writing = write;
    } else if ((player.action === "chant" && !input.chant) || (inBag && !input.bag)
      || (player.action === "write" && !input.chant && !input.bag)) {
      player.action = "none";
      player.writing = null;
    } else if (free && input.chant && !player.brokenOff) {
      startAction(world, e, player, "chant", input.aimX, input.aimZ);
      endChain(wielder);
    } else if (free && input.bag && !player.brokenOff) {
      startAction(world, e, player, "bag", input.aimX, input.aimZ);
      endChain(wielder);
    } else if (free && weapon && player.attackBuffer > 0 && player.queued !== null && stamina.value > 0) {
      startAttack(world, e, player, wielder, weapon, input, player.queued);
      spend(stamina, isSwing(player.queued) ? PLAYER.swing.cost : PLAYER.stab.cost);
      player.attackBuffer = 0;
    } else if (player.action === "none" && weapon && input.block && player.grounded) {
      startAction(world, e, player, "block", input.aimX, input.aimZ);
      endChain(wielder);
    }

    const t = player.actionTime, dir = player.actionDir;
    switch (player.action) {
      case "attack": {
        const swing = wielder.swing;
        if (!swing) break;
        const move = isSwing(swing.attack) ? PLAYER.swing : PLAYER.stab;
        if (bladeLive(swing)) {
          v.x = dir.x * move.lungeSpeed;
          v.z = dir.z * move.lungeSpeed;
        } else shuffle(input, v, dt, walkSpeed * PLAYER.swing.moveFactor);
        if (swing.step >= swing.endAt) {
          player.action = "none";
          if (wielder.combo !== null) wielder.comboTime = CHAIN.gapTime;
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
      case "beam":
        shuffle(input, v, dt, walkSpeed * SKILL_EFFECTS.castMoveFactor);
        break;
      case "chant":
      case "write":
      case "bag":
        v.x = approach(v.x, 0, PLAYER.accel * dt);
        v.z = approach(v.z, 0, PLAYER.accel * dt);
        break;
      case "none":
        locomotion(player, input, v, dt, walkSpeed);
        break;
    }
    player.actionTime += dt;

    const move = input.gear;
    if (gearPressed && move && player.action === "bag" && move.from.in !== "cloth" && move.to.in !== "cloth") {
      const moved = moveGear({ ...player.gear, cloth: emptyCloth() }, move.from, move.to, move.turned);
      if (moved) {
        player.gear = { bag: moved.bag, equipment: moved.equipment };
        wielder.hands = handsOf(moved.equipment);
      }
    }
  }
  player.jumpHeld = input.jump;
  skilled.chanting = player.action === "chant" || (player.action === "write" && input.chant);

  // Stamina: paused during actions (blocking too, not chanting or in the bag), regenerates after a short delay.
  if (player.action !== "none" && player.action !== "chant" && player.action !== "write" && player.action !== "bag") {
    stamina.regenDelay = PLAYER.staminaRegenDelay;
  }
  else if (stamina.regenDelay > 0) stamina.regenDelay -= dt;
  else {
    const charged = (statuses?.left.charged ?? 0) > 0 ? SKILL_EFFECTS.self.lightning.staminaRegenFactor : 1;
    stamina.value = Math.min(stamina.max, stamina.value + PLAYER.staminaRegenPerSec * charged * dt);
  }
}
