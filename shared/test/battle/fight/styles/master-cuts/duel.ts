import {
  cutSteps, cutWindupTime, Cuts, emptyBag, Health, Player, Stamina, starterEquipment, WEAPONS, Wielder, type CutMove, type PlayerInputData,
  type Stance,
} from "@infinite-tower/shared";
import { Fight, type FightEvent, type PlayerSetup } from "@infinite-tower/shared/fight";
import { ARENA, input, player } from "../../fixtures.js";

export const GAP_M = 2;

export const pvp = (first: Partial<PlayerSetup> = {}, second: Partial<PlayerSetup> = {}) => new Fight({
  arena: ARENA, duel: true, enemies: [], style: "master-cuts",
  players: [player({ x: 0, y: 0.05, z: 0 }, first), player({ x: 0, y: 0.05, z: GAP_M }, second)],
});

export const holding = (rightHand: "sword" | "longsword" | "greatsword"): Partial<PlayerSetup> =>
  ({ gear: { bag: emptyBag(), equipment: { ...starterEquipment(), rightHand } } });

export const landsAfter = (move: CutMove, stance: Stance, chain = 0, heft: number = WEAPONS.sword.heft): number =>
  cutSteps(heft, move, cutWindupTime(move, stance, chain)).liveAt;

const FACING_0 = { aimX: 0, aimZ: 1, locked: 1 };
const FACING_1 = { aimX: 0, aimZ: -1, locked: 0 };
export type Script = (s: number) => Partial<PlayerInputData>;

export function play(fight: Fight, steps: number, a: Script = () => ({}), b: Script = () => ({})): FightEvent[] {
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const s = fight.steps + 1;
    fight.step([input({ ...FACING_0, ...a(s) }), input({ ...FACING_1, ...b(s) })]);
    events.push(...fight.events);
  }
  return events;
}

export const playTo = (fight: Fight, step: number, a?: Script, b?: Script): FightEvent[] =>
  play(fight, step - fight.steps, a, b);

export const hp = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Health).hp;
export const maxHp = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Health).max;
export const hitstun = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Health).hitstun;
export const stamina = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Stamina).value;
export const me = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Player);
export const cuts = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Cuts);
export const swingOf = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Wielder).swing;

export const pressAt = (step: number, over: Partial<PlayerInputData>): Script => (s) => (s === step ? over : {});
export const both = (...scripts: Script[]): Script => (s) => Object.assign({}, ...scripts.map((f) => f(s)));
export const stanceFrom = (step: number, stance: Stance): Script => (s) => (s >= step ? { stance } : {});
export const inStance = (stance: Stance): Script => stanceFrom(1, stance);
export const SETTLED = 40;
