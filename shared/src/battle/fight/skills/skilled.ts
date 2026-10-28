import type { Entity, System, World } from "../../../core/ecs.js";
import type { Vec2 } from "../../../core/math.js";
import { skillCost, skillOf, type Skill, type Word } from "../../../skills/skill.js";
import { Enemy, Health, Skilled, Stamina, type EnemyState, type SkilledData } from "../../components.js";

const STUNNED: readonly EnemyState[] = ["stunned", "parried", "staggered", "dead"];

export const newSkilled = (aim: Vec2, seed: number): SkilledData => ({
  chanting: false, words: [], casting: null, castTime: 0, beaming: false, held: false, aim: { ...aim }, target: null,
  rng: seed >>> 0,
});

/** False if it's busy or short of stamina (paid at release). */
export function startCast(world: World, e: Entity, skill: Skill): boolean {
  const skilled = world.require(e, Skilled), stamina = world.get(e, Stamina);
  if (skilled.casting || skilled.beaming || (stamina && stamina.value < skillCost(skill))) return false;
  if (skilled.chanting) skilled.words = [];
  Object.assign(skilled, { chanting: false, casting: skill, castTime: 0 });
  return true;
}

export function chant(world: World, e: Entity, words: readonly Word[]): void {
  Object.assign(world.require(e, Skilled), { chanting: true, words: [...words] });
}

export function releaseChant(world: World, e: Entity): boolean {
  const skill = skillOf(world.require(e, Skilled).words);
  return skill !== null && startCast(world, e, skill);
}

/** The chant closes but keeps its words (a dodge). */
export function endCast(skilled: SkilledData): void {
  Object.assign(skilled, { chanting: false, casting: null, beaming: false });
}

/** A stun: an open chant loses its words too. */
export function interrupt(skilled: SkilledData): void {
  if (skilled.chanting) skilled.words = [];
  endCast(skilled);
}

export function cantCast(world: World, e: Entity): boolean {
  const health = world.require(e, Health), state = world.get(e, Enemy)?.state;
  return health.hp <= 0 || health.hitstun > 0 || (state !== undefined && STUNNED.includes(state));
}

/** Early in the step, so whoever reacts to a wind-up (a sidestep) sees it from the step it started. */
export function windUpSystem(): System {
  return (world, dt) => {
    for (const [, skilled] of world.query(Skilled)) if (skilled.casting) skilled.castTime += dt;
  };
}
