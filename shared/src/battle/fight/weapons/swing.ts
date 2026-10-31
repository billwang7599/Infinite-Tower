import type { Entity, System, World } from "../../../core/ecs.js";
import type { Vec2 } from "../../../core/math.js";
import { toSteps } from "../../../core/time.js";
import type { Equipment } from "../../../items/gear.js";
import {
  HYBRID, sideOfWay, strikeDamage, wayShape, wayStepsAfter, type Strike, type Way,
} from "../../../weapons/hybrid.js";
import {
  punchDamage, strikeShape, strikeSteps, type Line, type StrikeMove,
} from "../../../weapons/one-strike.js";
import { moveDamage, POSTURE_MOVES, postureSteps, type PostureMove } from "../../../weapons/posture.js";
import {
  attackDamage, attackShape, attackSteps, ATTACKS, FEINT, weaponIn, type AttackKind, type GuardSide, type Weapon,
} from "../../../weapons/weapons.js";
import { ActiveHit, Wielder, type SwingData, type WielderData } from "../../components.js";
import { FighterStats } from "../../stats.js";
import { addHit } from "../combat.js";

export const handsOf = (equipment: Equipment): WielderData["hands"] =>
  ({ rightHand: equipment.rightHand, leftHand: equipment.leftHand });

export const bladeLive = (swing: SwingData): boolean => swing.step >= swing.liveAt && swing.step < swing.liveUntil;

export const lastFeintStep = (swing: SwingData): number => swing.liveAt - toSteps(FEINT.cutoffTime) - 1;
export const feintable = (swing: SwingData): boolean => swing.attack === "heavy" && swing.step <= lastFeintStep(swing);

export function startSwing(
  world: World, e: Entity, weapon: Weapon, attack: AttackKind, side: GuardSide, chain: number, dir: Vec2, swift = 1,
): void {
  world.remove(e, ActiveHit);
  world.require(e, Wielder).swing = {
    attack, side, way: null, chain, dir, step: 0, ...attackSteps(weapon, attack, chain, swift),
    damage: attackDamage(weapon, attack, world.require(e, FighterStats)),
    poiseDamage: ATTACKS[attack].poiseDamage, posture: 0, perilous: null, line: null, punch: false,
  };
}

export function startWaySwing(
  world: World, e: Entity, weapon: Weapon, strike: Strike, way: Way, windupTime: number, power: number, dir: Vec2,
): void {
  world.remove(e, ActiveHit);
  world.require(e, Wielder).swing = {
    attack: strike === "heavy" ? "heavy" : "light", side: sideOfWay(way), way, chain: 0, dir, step: 0,
    ...wayStepsAfter(weapon, windupTime, strike === "heavy"),
    damage: strikeDamage(weapon, strike, power, world.require(e, FighterStats)),
    poiseDamage: HYBRID[strike].poiseDamage, posture: 0, perilous: null, line: null, punch: false,
  };
}

const POSTURE_WAYS: Record<PostureMove, Way | null> = { swing: null, finisher: null, thrust: "stab", sweep: "lr" };

export function startPostureSwing(
  world: World, e: Entity, weapon: Weapon, move: PostureMove, chain: number, dir: Vec2, windupTime: number,
  delayTime = 0,
): void {
  world.remove(e, ActiveHit);
  const perilous = move === "thrust" || move === "sweep" ? move : null;
  world.require(e, Wielder).swing = {
    attack: move === "swing" ? "light" : "heavy", side: "top", way: POSTURE_WAYS[move], chain, dir, step: 0,
    ...postureSteps(weapon, move, windupTime, delayTime),
    damage: moveDamage(weapon, move, world.require(e, FighterStats)), poiseDamage: 0,
    posture: POSTURE_MOVES[move].posture * weapon.heft, perilous, line: null, punch: false,
  };
}

/** A punch's `heft` is 1: fists. */
export function startStrikeSwing(
  world: World, e: Entity, heft: number, move: StrikeMove, line: Line | null, dir: Vec2, windupTime?: number,
): void {
  world.remove(e, ActiveHit);
  const punch = move === "punch";
  world.require(e, Wielder).swing = {
    attack: "light", side: "top", way: null, chain: 0, dir, step: 0, ...strikeSteps(heft, move, windupTime),
    damage: punch ? punchDamage(world.require(e, FighterStats)) : 0, poiseDamage: 0, posture: 0, perilous: null,
    line: punch ? null : line, punch,
  };
}

export function endChain(wielder: WielderData): void {
  wielder.combo = null;
  wielder.comboTime = 0;
  wielder.momentum = 0;
}

export function endSwing(world: World, e: Entity): void {
  world.remove(e, ActiveHit);
  const wielder = world.get(e, Wielder);
  if (wielder) wielder.swing = null;
}

// Runs after the controllers and brains, which start and end swings.
export function weaponSystem(): System {
  return (world) => {
    for (const [e, wielder] of world.query(Wielder)) {
      const swing = wielder.swing, weapon = weaponIn(wielder.hands);
      if (!swing) continue;
      if (!weapon || swing.step >= swing.endAt) {
        endSwing(world, e);
        continue;
      }
      if (!bladeLive(swing)) world.remove(e, ActiveHit);
      else if (!world.has(e, ActiveHit)) {
        const shape = swing.punch ? strikeShape("punch", wielder.armReachM, weapon)
          : swing.line ? strikeShape("thrust", wielder.armReachM, weapon)
          : swing.way ? wayShape(swing.way, wielder.armReachM, weapon)
          : attackShape(swing.side, wielder.armReachM, weapon);
        addHit(world, e, swing.dir.x, swing.dir.z, {
          ...shape, damage: swing.damage, poiseDamage: swing.poiseDamage, attack: swing.attack, side: swing.side,
          way: swing.way, posture: swing.posture, perilous: swing.perilous, line: swing.line,
        });
      }
      swing.step++;
    }
  };
}
