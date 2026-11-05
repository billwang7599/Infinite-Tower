import type { Entity, System, World } from "../../../core/ecs.js";
import { approach, type Vec3 } from "../../../core/math.js";
import { toSteps } from "../../../core/time.js";
import { dodgeCost, walkPace } from "../../../items/burden.js";
import { emptyCloth, heldIn, moveGear, NO_PILE, type Spot } from "../../../items/gear.js";
import { startUse } from "../../../items/using.js";
import {
  Body, Health, Player, Skilled, Stamina, Wielder, type HealthData, type PlayerAction, type PlayerData,
  type SkilledData,
} from "../../components.js";
import { SKILL_EFFECTS } from "../../../skills/effects.js";
import { sameSkill, skillCost, type Skill, type Skillbook } from "../../../skills/skill.js";
import { copyInput, PlayerInput, type PlayerInputData } from "../../input.js";
import { PLAYER } from "../../player.js";
import { FighterStats, moveSpeed, staminaRegenPerSec, type Stats } from "../../stats.js";
import { nockTime } from "../../../weapons/bow.js";
import { HYBRID } from "../../../weapons/hybrid.js";
import { dualWielding, guardOf, rangedOf } from "../../../weapons/kinds.js";
import { weaponIn } from "../../../weapons/weapons.js";
import { breakOff, canPayStamina, payStamina, spend } from "../combat.js";
import type { FightEvent } from "../context.js";
import { endCast, startCast } from "../skills/skilled.js";
import { modsOf, type StatMods } from "../../statuses.js";
import { bladeLive, endChain, endSwing, handsOf } from "../weapons/swing.js";
import { attackOrBlock, readSword, type SwordTurn } from "./sword.js";

const carried = (spot: Spot) => spot.in !== "cloth" && spot.in !== "pile";
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

  const pressed = input.jump && !player.last.jump;
  player.jumpBuffer = pressed ? PLAYER.jumpBuffer : Math.max(0, player.jumpBuffer - dt);
  const canJump = player.grounded || player.airTime < PLAYER.coyoteTime;
  if (player.jumpBuffer > 0 && canJump) {
    v.y = PLAYER.jumpSpeed;
    player.jumpBuffer = 0;
    player.grounded = false;
    player.airTime = PLAYER.coyoteTime; // no second coyote jump
  }
  if (!input.jump && player.last.jump && v.y > 0) v.y *= PLAYER.jumpCutMultiplier;
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
export function playerControllerSystem(targets: readonly Entity[], events: FightEvent[], wallM: number): System {
  return (world, dt) => {
    for (const [e] of world.query(Player, PlayerInput, Body, Health, Stamina, FighterStats, Wielder, Skilled)) {
      controlPlayer(world, e, dt, targets, events, wallM);
    }
  };
}

interface Turn extends SwordTurn {
  health: HealthData;
  stats: Stats;
  mods: StatMods;
  skilled: SkilledData;
  /** Its blade still to land: an early press waits rather than runs out. */
  locked: boolean;
  skillbook: boolean;
}

function controlPlayer(
  world: World, e: Entity, dt: number, targets: readonly Entity[], events: FightEvent[], wallM: number,
): void {
  const player = world.require(e, Player), input = world.require(e, PlayerInput), last = player.last;
  const health = world.require(e, Health), skilled = world.require(e, Skilled), wielder = world.require(e, Wielder);
  const swing = wielder.swing, stunned = health.hp <= 0 || health.hitstun > 0;
  const locked = swing !== null && swing.step < swing.liveUntil;
  if (input.switchHand && !last.switchHand && dualWielding(wielder.hands)) player.handSwitchQueued = true;
  if (player.handSwitchQueued && !locked && !stunned) {
    player.handSwitchQueued = false;
    const active = wielder.hands.active === "rightHand" ? "leftHand" : "rightHand";
    if (dualWielding(wielder.hands)) wielder.hands = { ...wielder.hands, active };
  }
  const t: Turn = {
    world, e, dt, events, player, input, wielder, health, skilled, stamina: world.require(e, Stamina),
    stats: world.require(e, FighterStats), mods: modsOf(world, e), weapon: weaponIn(wielder.hands),
    guard: guardOf(wielder.hands)?.guard ?? null, skillbook: heldIn(wielder.hands, "skillbook") !== null, stunned,
    locked, free: false,
  };
  readSword(t);
  if (input.dodge && !last.dodge) player.dodgeBuffer = PLAYER.inputBuffer;
  else if (!t.locked) player.dodgeBuffer = Math.max(0, player.dodgeBuffer - dt);
  player.dodgeCooldownSteps = Math.max(0, player.dodgeCooldownSteps - 1);
  if (input.cast !== null && !skilled.held) {
    player.castQueued = input.cast;
    player.castBuffer = PLAYER.inputBuffer;
  } else if (!t.locked) player.castBuffer = Math.max(0, player.castBuffer - dt);
  if (input.chantWords !== null && last.chantWords === null) skilled.words = [...input.chantWords];
  skilled.held = input.cast !== null || input.castHeld;
  skilled.aim = { x: input.aimX, z: input.aimZ };
  const { x, y, z } = input.aimAt, inside = Math.min(1, wallM / Math.hypot(x, z));
  skilled.aimAt = { x: x * inside, y: Math.max(0, y), z: z * inside };
  const lockedOn = input.locked === null ? null : targets[input.locked] ?? null;
  skilled.target = lockedOn === e ? null : lockedOn;
  if (!input.chant && !input.bag) player.brokenOff = false;

  if (t.stunned) stagger(t);
  else {
    if (STUNNED.includes(player.action)) player.action = "none";
    t.free = player.action === "none" || player.action === "block" || (player.action === "attack" && !t.locked);
    chooseAction(t);
    moveByAction(t);
    player.actionTime += dt;
    moveGearInBag(t);
  }
  player.last = copyInput(input);
  skilled.chanting = player.action === "chant" || (player.action === "write" && input.chant);
  refillStamina(t);
}

function stagger({ world, e, dt, player, skilled }: Turn): void {
  if (player.action !== "none" && !STUNNED.includes(player.action)) {
    breakOff(player, skilled);
    endSwing(world, e);
  }
  player.attackBuffer = player.dodgeBuffer = player.castBuffer = 0;
  if (player.grounded) {
    const v = world.require(e, Body).vel, slowdown = PLAYER.accel * 0.4 * dt;
    v.x = approach(v.x, 0, slowdown);
    v.z = approach(v.z, 0, slowdown);
  }
}

function chooseAction(t: Turn): void {
  const { world, e, player, input, health, stamina, wielder, free } = t, last = player.last;
  const burdenCost = dodgeCost(player.burden);
  const dodgeStamina = burdenCost === null ? null : burdenCost * t.mods.dodgeCostFactor;
  const chanting = player.action === "chant" || player.action === "write";
  const inBag = player.action === "bag", usingNow = player.action === "use";
  const using = inBag && input.use !== null && last.use === null && input.use.in !== "cloth"
    ? startUse(player.gear[input.use.in], input.use, {
      hp: health.hp, max: health.max, stamina: stamina.value, staminaMax: stamina.max, core: player.core,
    }) : null;
  let queuedCast = player.castQueued;
  if (queuedCast !== null && player.action !== "chant" && !(t.skillbook && onPage(player.book, queuedCast))) {
    player.castQueued = queuedCast = null;
    player.castBuffer = 0;
  }
  const write = input.write;
  // A dodge cancels a cast's wind-up, which costs nothing until it's released, and ends a Beam.
  const dodgeable = free || chanting || inBag || usingNow || player.action === "cast"
    || player.action === "beam" || player.action === "draw" || player.action === "loose";
  if (dodgeable && player.dodgeBuffer > 0 && player.dodgeCooldownSteps === 0 && dodgeStamina !== null
    && player.grounded && canPayStamina(world, e, stamina, dodgeStamina)) {
    let dx = input.moveX, dz = input.moveZ;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) { dx = -input.aimX; dz = -input.aimZ; } // backstep
    else { dx /= len; dz /= len; }
    startAction(world, e, player, "dodge", dx, dz);
    payStamina(world, e, stamina, dodgeStamina);
    player.dodgeBuffer = 0;
    endChain(wielder);
  } else if ((free || player.action === "chant") && player.castBuffer > 0 && queuedCast !== null
    && stamina.value >= skillCost(queuedCast)) {
    startCast(world, e, queuedCast);
    startAction(world, e, player, "cast", input.aimX, input.aimZ);
    player.castBuffer = 0;
    endChain(wielder);
  } else if (t.skillbook && (player.action === "chant" || inBag) && write !== null && last.write === null
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
    attackOrBlock(t);
  }
}

function moveByAction({ world, e, dt, player, input, wielder, stamina, stats, mods }: Turn): void {
  const v = world.require(e, Body).vel, t = player.actionTime, dir = player.actionDir;
  const walkSpeed = moveSpeed(PLAYER.moveSpeed, stats) * walkPace(player.burden) * mods.moveFactor;
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
      const dodge = PLAYER.dodge, progress = Math.min(1, t / dodge.duration);
      const speed = moveSpeed(dodge.speed + (dodge.endSpeed - dodge.speed) * progress * progress, stats);
      v.x = dir.x * speed;
      v.z = dir.z * speed;
      if (t >= dodge.duration) {
        player.action = "none";
        player.dodgeCooldownSteps = toSteps(dodge.cooldown);
      }
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
    case "draw":
    case "loose": {
      const bow = rangedOf(weaponIn(wielder.hands));
      if (player.action === "draw") player.actionDir = { x: input.aimX, z: input.aimZ };
      shuffle(input, v, dt, walkSpeed * (bow?.draw.moveFactor ?? 1));
      const nocked = bow && toSteps(t) >= toSteps(nockTime(bow, player.gear.quiver));
      if (!bow || (player.action === "loose" && nocked)) player.action = "none";
      break;
    }
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
}

function moveGearInBag({ player, input, wielder, stats }: Turn): void {
  const move = input.gear;
  if (!move || player.last.gear !== null || player.action !== "bag" || !carried(move.from) || !carried(move.to)) {
    return;
  }
  const gear = { ...player.gear, cloth: emptyCloth(), pile: NO_PILE };
  const moved = moveGear(gear, move.from, move.to, move.turned, stats.strength);
  if (moved) {
    player.gear = { bag: moved.bag, pack: moved.pack, quiver: moved.quiver, equipment: moved.equipment };
    wielder.hands = handsOf(moved.equipment, wielder.hands.active);
  }
}

function refillStamina({ dt, player, stamina, stats, mods }: Turn): void {
  if (!STILL.includes(player.action)) stamina.regenDelay = PLAYER.staminaRegenDelay;
  else if (stamina.regenDelay > 0) stamina.regenDelay -= dt;
  else {
    const regenPerSec = staminaRegenPerSec(stats, mods.staminaRegenFactor);
    stamina.value = Math.min(stamina.max, stamina.value + regenPerSec * dt);
  }
}
