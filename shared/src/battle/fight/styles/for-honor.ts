import type { Entity, World } from "../../../core/ecs.js";
import type { Vec2, Vec3 } from "../../../core/math.js";
import { toSteps } from "../../../core/time.js";
import { shotOf } from "../../../skills/effects.js";
import {
  attackCost, ATTACKS, blocks, COMBAT, FEINT, GUARD_BREAK, PARRY, parryOpenTime, weaponIn, type AttackKind,
  type GuardSide,
} from "../../../weapons/weapons.js";
import {
  Body, Enemy, Health, Player, Skilled, Stamina, WeaponAttack, Wielder, type ActiveHitData,
} from "../../components.js";
import { PLAYER } from "../../player.js";
import { weaponAttackSystem } from "../behaviors/weapon.js";
import { enter } from "../behaviors/common.js";
import { faces, knock, stagger, type Defended } from "../combat.js";
import type { FightEvent } from "../context.js";
import { spend, startAction } from "../player/controller.js";
import { imbueOf } from "../skills/cast.js";
import { guardBreakSystem, startGrab } from "../weapons/guard-break.js";
import { endSwing, feintable, startSwing } from "../weapons/swing.js";
import type { Style, SwordTurn } from "./styles.js";

const GUARDING = new Set(["approach", "weaponWindup"]);
const PARRY_STEPS = toSteps(PARRY.windowTime);

const chainSpent = ({ wielder: { swing } }: SwordTurn): boolean =>
  swing !== null && swing.chain + 1 >= COMBAT.maxChain && swing.step < swing.endAt;

function read(t: SwordTurn): void {
  const { player, input, wielder: { swing }, weapon, dt } = t;
  const locked = swing !== null && swing.step < swing.liveUntil;
  const attackPressed = weapon !== null && input.attack !== null && input.attack !== "stab"
    && input.attack !== player.attackHeld;
  const guardBreakPressed = input.guardBreak && !player.guardBreakHeld;
  const feint = guardBreakPressed && player.action === "attack" && swing !== null && feintable(swing);
  if (!locked) player.guard = weapon && input.locked !== null ? input.guard : null;
  if (attackPressed) {
    player.queued = input.attack;
    player.attackBuffer = PLAYER.inputBuffer;
  } else if (!locked && !chainSpent(t)) player.attackBuffer = Math.max(0, player.attackBuffer - dt);
  if (guardBreakPressed && !feint) player.guardBreakBuffer = PLAYER.inputBuffer;
  else if (!locked) player.guardBreakBuffer = Math.max(0, player.guardBreakBuffer - dt);
  player.attackHeld = input.attack;
  player.guardBreakHeld = input.guardBreak;
  if (t.stunned) {
    player.guardBreakBuffer = player.action === "grabbed" && guardBreakPressed ? PLAYER.inputBuffer : 0;
  } else if (feint) {
    endSwing(t.world, t.e);
    spend(t.stamina, FEINT.cost);
    player.action = "none";
    t.events.push({ type: "feint", by: t.e });
  }
}

function guardBreak({ world, e, player, input, wielder, stamina, weapon, free }: SwordTurn): boolean {
  if (!free || !weapon || player.guardBreakBuffer <= 0 || !player.grounded || stamina.value <= 0) return false;
  startAction(world, e, player, "grab", input.aimX, input.aimZ);
  startGrab(wielder);
  spend(stamina, GUARD_BREAK.cost);
  player.guardBreakBuffer = 0;
  return true;
}

function attack(t: SwordTurn): boolean {
  const { world, e, player, input, wielder, stamina, weapon } = t, queued = player.queued;
  if (!t.free || chainSpent(t) || !weapon || player.attackBuffer <= 0 || queued === null || queued === "stab"
    || stamina.value <= 0) return false;
  const last = wielder.swing, chain = last && last.step < last.endAt ? last.chain + 1 : 0;
  startAction(world, e, player, "attack", input.aimX, input.aimZ);
  const imbue = imbueOf(world, e)?.[1];
  const swift = imbue ? shotOf(imbue.skill.segments[imbue.segment]!).swiftFactor : 1;
  startSwing(world, e, weapon, queued, player.guard ?? "top", chain, { x: input.aimX, z: input.aimZ }, swift);
  spend(stamina, attackCost(weapon, queued));
  player.attackBuffer = 0;
  return true;
}

export function guardOf(world: World, e: Entity): { side: GuardSide; facing: Vec2 } | null {
  const player = world.get(e, Player), hands = world.get(e, Wielder)?.hands;
  if (!hands || !weaponIn(hands)) return null;
  if (player) {
    const idle = player.action === "none" && world.require(e, Health).hitstun <= 0;
    return idle && player.guard ? { side: player.guard, facing: world.require(e, Skilled).aim } : null;
  }
  const enemy = world.get(e, Enemy), attack = world.get(e, WeaponAttack);
  if (!enemy || !attack || !GUARDING.has(enemy.state)) return null;
  const side = attack.guardMoveTime > 0 ? attack.guardFrom : attack.guard;
  return { side, facing: { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) } };
}

function defend(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): Defended {
  const from = world.require(attacker, Body).pos;
  if (parries(world, target, hit, from)) {
    parried(world, events, attacker, hit.attack!, target);
    return "parried";
  }
  const guard = guardOf(world, target);
  if (!guard || !blocks(guard.side, hit.side)
    || !faces(world.require(target, Body).pos, guard.facing, from, COMBAT.guardMinDot)) return null;
  blocked(world, events, attacker, hit, target);
  return "blocked";
}

function parries(world: World, target: Entity, hit: ActiveHitData, from: Vec3): boolean {
  const swing = world.get(target, Wielder)?.swing;
  if (!swing || swing.attack !== "heavy" || hit.attack === null) return false;
  // The weapon system ran this step: the swing's clock is one step on.
  return swing.step - 1 <= PARRY_STEPS && blocks(swing.side, hit.side)
    && faces(world.require(target, Body).pos, swing.dir, from, COMBAT.guardMinDot);
}

function parried(world: World, events: FightEvent[], attacker: Entity, attack: AttackKind, parrier: Entity): void {
  const weapon = weaponIn(world.require(parrier, Wielder).hands)!;
  endSwing(world, parrier);
  const player = world.get(parrier, Player), enemy = world.get(parrier, Enemy), stamina = world.get(parrier, Stamina);
  if (player) {
    player.action = "none";
    if (stamina) stamina.value = Math.min(stamina.max, stamina.value + attackCost(weapon, "heavy"));
  } else if (enemy) {
    enter(world, parrier, enemy, "approach");
    const riposte = world.get(parrier, WeaponAttack);
    if (riposte) riposte.riposte = true;
  }
  stagger(world, attacker, parryOpenTime(weapon, attack));
  events.push({ type: "parry", by: parrier, target: attacker, attack });
}

function blocked(world: World, events: FightEvent[], attacker: Entity, hit: ActiveHitData, target: Entity): void {
  events.push({ type: "block", by: attacker, target });
  if (hit.attack === null) {
    const body = world.require(target, Body), from = world.require(attacker, Body).pos;
    knock(body.pos, from, body.vel, hit.knockback * COMBAT.pushbackFactor, 0, { x: hit.dirX, z: hit.dirZ });
    return;
  }
  const recoilTime = ATTACKS[hit.attack].recoilTime;
  endSwing(world, attacker);
  const player = world.get(attacker, Player), enemy = world.get(attacker, Enemy);
  if (player) {
    player.action = "recoil";
    world.require(attacker, Health).hitstun = recoilTime;
  } else if (enemy) {
    Object.assign(enemy, { state: "recoil", stateTime: 0, duration: recoilTime });
    const attack = world.get(attacker, WeaponAttack);
    if (attack) attack.cooldown = Math.max(attack.cooldown, recoilTime + attack.def.cooldown);
  }
}

export const FOR_HONOR: Style = {
  read, first: guardBreak, last: attack, defend, swordsman: weaponAttackSystem, after: guardBreakSystem,
};
