import type { Entity, System, World } from "../../../../core/ecs.js";
import { turnToward } from "../../../../core/math.js";
import { FIXED_DT, toSteps } from "../../../../core/time.js";
import {
  lineMoveSteps, LINES, linesApart, ONE_STRIKE, thrustReach, type Line,
} from "../../../../weapons/one-strike.js";
import { weaponIn, type Weapon } from "../../../../weapons/weapons.js";
import {
  Body, Enemy, OneStrike, Sidestep, WeaponAttack, Wielder, type EnemyData, type OneStrikeData,
  type StrikeReaction, type WeaponAttackData,
} from "../../../components.js";
import type { OneStrikeSwordsmanDef } from "../../../defs.js";
import { FighterStats, moveSpeed } from "../../../stats.js";
import { enter, roll } from "../../behaviors/common.js";
import { MIN_FACING_DOT, WINDUP_TURN_RAD_PER_SEC } from "../../behaviors/weapon.js";
import { startStrikeSwing } from "../../weapons/swing.js";
import { gapTo, lineOf } from "./blade.js";

const MEASURE_SLACK_M = 0.15;
const STEP_IN_ACCEL = 100;

const facingOf = (enemy: EnemyData) => ({ x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) });

function reactSteps(enemy: EnemyData, def: OneStrikeSwordsmanDef): number {
  return Math.max(1, toSteps(def.reactTime + (roll(enemy) * 2 - 1) * def.reactJitterTime));
}

function expect(attack: WeaponAttackData, reaction: StrikeReaction | null, line: Line, steps: number): void {
  Object.assign(attack, { reaction, reactLine: line, reactSteps: steps });
}

function perceive(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, inReach: boolean): void {
  const def = attack.def.oneStrike, target = enemy.sense.target!, theirs = world.get(target, OneStrike);
  const ready = inReach && enemy.state === "approach";
  if (theirs && theirs.want !== attack.seenWant) {
    const first = attack.seenWant === null;
    attack.seenWant = theirs.want;
    if (!first && ready) {
      expect(attack, roll(enemy) < def.followChance ? "follow" : null, theirs.want, reactSteps(enemy, def));
    }
  }
  const swing = world.get(target, Wielder)?.swing, mine = world.require(e, OneStrike);
  if (!ready || swing?.step !== 0 || swing.line === null || swing.line === lineOf(world, e)) return;
  const react = reactSteps(enemy, def), r = roll(enemy);
  if (r < def.disarmChance) {
    if (mine.moveSteps > 0) return;
    const moving = linesApart(mine.line, swing.line) * lineMoveSteps(weaponIn(world.require(e, Wielder).hands)!.heft);
    const start = Math.max(react, swing.liveAt - moving);
    if (start < swing.liveAt) expect(attack, "disarm", swing.line, start);
  } else if (r < def.disarmChance + def.stepBackChance && react < swing.liveAt) {
    expect(attack, "back", swing.line, react);
  }
}

function react(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, blade: OneStrikeData): void {
  const reaction = attack.reaction;
  attack.reaction = null;
  if (enemy.state !== "approach" || blade.loose || reaction === null) return;
  if (reaction !== "back") {
    blade.want = attack.reactLine;
    return;
  }
  const step = world.get(e, Sidestep), target = enemy.sense.target;
  if (!step || target === null) return;
  const at = world.require(e, Body).pos, from = world.require(target, Body).pos;
  const dx = at.x - from.x, dz = at.z - from.z, dist = Math.hypot(dx, dz) || 1;
  step.dir = { x: dx / dist, z: dz / dist };
  enter(world, e, enemy, "sidestep");
}

function toBlade(world: World, e: Entity, enemy: EnemyData, blade: OneStrikeData): void {
  const at = world.require(e, Body).pos, dx = blade.loose!.x - at.x, dz = blade.loose!.z - at.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= ONE_STRIKE.pickup.reachM) {
    enter(world, e, enemy, "pickup");
    blade.pickupStep = 0;
    return;
  }
  Object.assign(enemy.move, {
    dirX: dx / dist, dirZ: dz / dist, speed: moveSpeed(enemy.def.walkSpeed, world.require(e, FighterStats)),
  });
}

function thrust(
  world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon, line: Line,
): void {
  startStrikeSwing(world, e, weapon.heft, "thrust", line, facingOf(enemy), attack.def.oneStrike.thrustWindupTime);
  const liveAt = world.require(e, Wielder).swing!.liveAt;
  // Not `enter`: that would end the swing.
  Object.assign(enemy, { state: "weaponWindup", stateTime: 0, duration: liveAt * FIXED_DT });
}

function decide(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, blade: OneStrikeData): void {
  const def = attack.def.oneStrike;
  attack.cooldown = def.decideMinTime + roll(enemy) * (def.decideMaxTime - def.decideMinTime);
  const r = roll(enemy);
  if (r < def.matched.thrust) {
    const others = LINES.filter((line) => line !== blade.line);
    blade.want = others[Math.floor(roll(enemy) * others.length)]!;
  } else if (r < def.matched.thrust + def.matched.beat) {
    enter(world, e, enemy, "beat");
    blade.beatStep = 0;
  }
}

function approach(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon | null): void {
  const blade = world.require(e, OneStrike), sense = enemy.sense, target = sense.target;
  if (blade.loose) return toBlade(world, e, enemy, blade);
  if (!weapon || !sense.targetAlive || target === null) return;
  const measure = thrustReach(world.require(e, Wielder).armReachM, weapon) + attack.def.oneStrike.measureM;
  const gap = gapTo(world, e, target), walk = moveSpeed(enemy.def.walkSpeed, world.require(e, FighterStats));
  const off = gap - measure;
  enemy.move.speed = off > MEASURE_SLACK_M ? walk * Math.max(0, sense.facingDot) : off < -MEASURE_SLACK_M ? -walk : 0;
  const mine = lineOf(world, e);
  const reading = attack.reactSteps > 0 || mine === null || blade.want !== mine;
  if (reading || sense.facingDot <= MIN_FACING_DOT || off > MEASURE_SLACK_M) return;
  if (lineOf(world, target) !== mine) thrust(world, e, enemy, attack, weapon, mine);
  else if (attack.cooldown <= 0) decide(world, e, enemy, attack, blade);
}

export function oneStrikeSwordsmanSystem(): System {
  return (world, dt) => {
    for (const [e, attack, enemy, wielder] of world.query(WeaponAttack, Enemy, Wielder)) {
      const blade = world.get(e, OneStrike);
      if (!blade) continue;
      const sense = enemy.sense, target = sense.target, swing = wielder.swing, weapon = weaponIn(wielder.hands);
      attack.cooldown -= dt;
      if (enemy.state === "staggered" || enemy.state === "dead") attack.reaction = null;
      if (attack.reactSteps > 0) attack.reactSteps--;
      if (target !== null && weapon && !blade.loose) {
        const measure = thrustReach(wielder.armReachM, weapon) + attack.def.oneStrike.measureM;
        const inReach = gapTo(world, e, target) <= measure + MEASURE_SLACK_M && sense.facingDot > MIN_FACING_DOT;
        perceive(world, e, enemy, attack, inReach);
      }
      if (attack.reactSteps === 0 && attack.reaction !== null) react(world, e, enemy, attack, blade);
      switch (enemy.state) {
        case "approach":
          approach(world, e, enemy, attack, weapon);
          break;
        case "weaponWindup":
        case "weapon":
          if (!swing) {
            enter(world, e, enemy, "approach");
            break;
          }
          if (swing.step < swing.liveAt) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
            swing.dir = facingOf(enemy);
            break;
          }
          if (enemy.state === "weaponWindup") Object.assign(enemy, { state: "weapon", stateTime: 0 });
          if (swing.step < swing.liveUntil) {
            Object.assign(enemy.move, { speed: ONE_STRIKE.thrust.stepInSpeed, accel: STEP_IN_ACCEL });
            break;
          }
          // Not `enter`: the blade recovers.
          Object.assign(enemy, {
            state: "weaponRecover", stateTime: 0, duration: (swing.endAt - swing.step) * FIXED_DT,
          });
          break;
        case "weaponRecover":
          if (enemy.stateTime >= enemy.duration) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
