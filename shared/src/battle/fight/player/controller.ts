import type { Entity, System, World } from "../../../core/ecs.js";
import { approach, type Vec3 } from "../../../core/math.js";
import { dodgeCost, walkPace } from "../../../items/burden.js";
import { emptyCloth, heldIn, moveGear, NO_PILE, type Spot } from "../../../items/gear.js";
import { startUse } from "../../../items/using.js";
import {
  Body, Health, Player, Skilled, Stamina, Statuses, Wielder, type PlayerAction, type PlayerData,
} from "../../components.js";
import { SKILL_EFFECTS } from "../../../skills/effects.js";
import { sameSkill, skillCost, type Skill, type Skillbook } from "../../../skills/skill.js";
import { PlayerInput, type PlayerInputData } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats, moveSpeed, staminaRegenPerSec } from "../../stats.js";
import { HYBRID } from "../../../weapons/hybrid.js";
import { weaponIn } from "../../../weapons/weapons.js";
import { breakOff, spend } from "../combat.js";
import type { FightEvent } from "../context.js";
import { endCast, startCast } from "../skills/skilled.js";
import { statusMoveFactor } from "../skills/statuses.js";
import { bladeLive, endChain, endSwing, handsOf } from "../weapons/swing.js";
import { attackOrBlock, readSword, type SwordTurn } from "./sword.js";

const carried = (spot: Spot) => spot.in === "bag" || spot.in === "slot";
const STUNNED: readonly PlayerAction[] = ["stagger"];
const STILL: readonly PlayerAction[] = ["none", "chant", "write", "bag", "use"];

export function startAction(
  world: World, e: Entity, player: PlayerData, action: PlayerAction, x: number, z: number,
): void {
  endSwing(world, e);
  if (["chant", "write", "bag", "use"].includes(player.action)) player.brokenOff = true;
  if (action !== "cast") endCast(world.require(e, Skilled));
  player.writing = null;
  player.using = null;
  player.action = action;
  player.actionTime = 0;
  player.actionDir = { x, z };
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

function shuffle(input: PlayerInputData, v: Vec3, dt: number, speed: number): void {
  const accel = PLAYER.accel * dt;
  v.x = approach(v.x, input.moveX * speed, accel);
  v.z = approach(v.z, input.moveZ * speed, accel);
}

/**
 * Moves and actions. Only ever writes velocity (the physics moves the body). Attacks go where the player aims (the
 * camera's facing, or the locked enemy); a dodge goes where they move, or backwards standing still.
 */
export function playerControllerSystem(targets: readonly Entity[], events: FightEvent[]): System {
  return (world, dt) => {
    for (const [e] of world.query(Player, PlayerInput, Body, Health, Stamina, FighterStats, Wielder, Skilled)) {
      controlPlayer(world, e, dt, targets, events);
    }
  };
}

function controlPlayer(world: World, e: Entity, dt: number, targets: readonly Entity[], events: FightEvent[]): void {
  const player = world.require(e, Player), input = world.require(e, PlayerInput), body = world.require(e, Body);
  const health = world.require(e, Health), stamina = world.require(e, Stamina), stats = world.require(e, FighterStats);
  const statuses = world.get(e, Statuses), wielder = world.require(e, Wielder), skilled = world.require(e, Skilled);
  const v = body.vel;
  const walkSpeed = moveSpeed(PLAYER.moveSpeed, stats) * walkPace(player.burden) * statusMoveFactor(statuses);
  const alive = health.hp > 0;

  const swing = wielder.swing, locked = swing !== null && swing.step < swing.liveUntil;
  const weapon = weaponIn(wielder.hands), skillbook = heldIn(wielder.hands, "skillbook") !== null;
  const stunned = !alive || health.hitstun > 0;
  const turn: SwordTurn = { world, e, dt, events, player, input, wielder, stamina, weapon, stunned, free: false };
  readSword(turn);
  const dodgePressed = input.dodge && !player.dodgeHeld;
  const castPressed = input.cast !== null && !skilled.held;
  if (dodgePressed) player.dodgeBuffer = PLAYER.inputBuffer;
  else if (!locked) player.dodgeBuffer = Math.max(0, player.dodgeBuffer - dt);
  if (castPressed) {
    player.castQueued = input.cast;
    player.castBuffer = PLAYER.inputBuffer;
  } else if (!locked) player.castBuffer = Math.max(0, player.castBuffer - dt);
  const writePressed = input.write !== null && !player.writeHeld;
  const gearPressed = input.gear !== null && !player.gearHeld;
  const usePressed = input.use !== null && !player.useHeld;
  if (input.chantWords !== null && !player.wordsHeld) skilled.words = [...input.chantWords];
  player.dodgeHeld = input.dodge;
  skilled.held = input.cast !== null || input.castHeld;
  player.writeHeld = input.write !== null;
  player.gearHeld = input.gear !== null;
  player.useHeld = input.use !== null;
  player.wordsHeld = input.chantWords !== null;
  skilled.aim = { x: input.aimX, z: input.aimZ };
  const lockedOn = input.locked === null ? null : targets[input.locked] ?? null;
  skilled.target = lockedOn === e ? null : lockedOn;
  if (!input.chant && !input.bag) player.brokenOff = false;

  if (stunned) {
    if (player.action !== "none" && !STUNNED.includes(player.action)) {
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
    if (STUNNED.includes(player.action)) player.action = "none";
    const dodge = PLAYER.dodge, burdenCost = dodgeCost(player.burden);
    const dodgeStamina = burdenCost === null ? null
      : burdenCost * ((statuses?.left.hasted ?? 0) > 0 ? SKILL_EFFECTS.self.air.dodgeCostFactor : 1);
    const free = player.action === "none" || player.action === "block" || (player.action === "attack" && !locked);
    turn.free = free;
    const chanting = player.action === "chant" || player.action === "write";
    const inBag = player.action === "bag", usingNow = player.action === "use";
    const using = inBag && usePressed && input.use?.in === "bag"
      ? startUse(player.gear.bag, input.use, { hp: health.hp, max: health.max, core: player.core }) : null;
    let queuedCast = player.castQueued;
    if (queuedCast !== null && player.action !== "chant" && !(skillbook && onPage(player.book, queuedCast))) {
      player.castQueued = queuedCast = null;
      player.castBuffer = 0;
    }
    const write = input.write;
    // A dodge cancels a cast's wind-up, which costs nothing until it's released, and ends a Beam.
    const dodgeable = free || chanting || inBag || usingNow || player.action === "cast"
      || player.action === "beam";
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
    } else if (using) {
      player.action = "use";
      player.actionTime = 0;
      player.using = using;
    } else if ((player.action === "chant" && !input.chant) || ((inBag || usingNow) && !input.bag)
      || (player.action === "write" && !input.chant && !input.bag)) {
      player.action = "none";
      player.writing = null;
      player.using = null;
    } else if (free && input.chant && !player.brokenOff) {
      startAction(world, e, player, "chant", input.aimX, input.aimZ);
      endChain(wielder);
    } else if (free && input.bag && !player.brokenOff) {
      startAction(world, e, player, "bag", input.aimX, input.aimZ);
      endChain(wielder);
    } else {
      attackOrBlock(turn);
    }

    const t = player.actionTime, dir = player.actionDir;
    switch (player.action) {
      case "attack": {
        const swing = wielder.swing;
        if (swing && bladeLive(swing)) {
          v.x = dir.x * HYBRID.swinging.lungeSpeed;
          v.z = dir.z * HYBRID.swinging.lungeSpeed;
        } else shuffle(input, v, dt, walkSpeed * HYBRID.swinging.moveFactor);
        if (!swing || swing.step >= swing.endAt) player.action = "none";
        break;
      }
      case "dodge": {
        const progress = Math.min(1, t / dodge.duration);
        const speed = moveSpeed(dodge.speed + (dodge.endSpeed - dodge.speed) * progress * progress, stats);
        v.x = dir.x * speed;
        v.z = dir.z * speed;
        if (t >= dodge.duration) player.action = "none";
        break;
      }
      case "cast":
      case "beam":
        shuffle(input, v, dt, walkSpeed * SKILL_EFFECTS.castMoveFactor);
        break;
      case "block":
        player.actionDir = { x: input.aimX, z: input.aimZ };
        shuffle(input, v, dt, walkSpeed * HYBRID.block.moveFactor);
        spend(stamina, HYBRID.block.holdStaminaPerSec * dt);
        break;
      case "chant":
      case "write":
      case "bag":
      case "use":
        v.x = approach(v.x, 0, PLAYER.accel * dt);
        v.z = approach(v.z, 0, PLAYER.accel * dt);
        break;
      case "none":
        locomotion(player, input, v, dt, walkSpeed);
        break;
    }
    player.actionTime += dt;

    const move = input.gear;
    if (gearPressed && move && player.action === "bag" && carried(move.from) && carried(move.to)) {
      const gear = { ...player.gear, cloth: emptyCloth(), pile: NO_PILE };
      const moved = moveGear(gear, move.from, move.to, move.turned, stats.strength);
      if (moved) {
        player.gear = { bag: moved.bag, equipment: moved.equipment };
        wielder.hands = handsOf(moved.equipment);
      }
    }
  }
  player.jumpHeld = input.jump;
  skilled.chanting = player.action === "chant" || (player.action === "write" && input.chant);

  if (!STILL.includes(player.action)) stamina.regenDelay = PLAYER.staminaRegenDelay;
  else if (stamina.regenDelay > 0) stamina.regenDelay -= dt;
  else {
    const charged = (statuses?.left.charged ?? 0) > 0 ? SKILL_EFFECTS.self.lightning.staminaRegenFactor : 1;
    const regenPerSec = staminaRegenPerSec(PLAYER.staminaRegenPerSec, stats) * charged;
    stamina.value = Math.min(stamina.max, stamina.value + regenPerSec * dt);
  }
}
