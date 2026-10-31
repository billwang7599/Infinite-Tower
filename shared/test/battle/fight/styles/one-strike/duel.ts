import {
  emptyBag, Health, lineMoveSteps, OneStrike, Player, Stamina, starterEquipment, strikeSteps, WEAPONS, Wielder,
  type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, type FightEvent, type PlayerSetup } from "@infinite-tower/shared/fight";
import { ARENA, input, player } from "../../fixtures.js";

export const GAP_M = 2;
export const PRESS = 5;
export const SWORD_LINE_STEPS = lineMoveSteps(WEAPONS.sword.heft);
export const SWORD_THRUST_STEPS = strikeSteps(WEAPONS.sword.heft, "thrust").liveAt;

export const pvp = (first: Partial<PlayerSetup> = {}, second: Partial<PlayerSetup> = {}) => new Fight({
  arena: ARENA, duel: true, enemies: [], style: "one-strike",
  players: [player({ x: 0, y: 0.05, z: 0 }, first), player({ x: 0, y: 0.05, z: GAP_M }, second)],
});

export const holding = (rightHand: "sword" | "longsword" | "greatsword"): Partial<PlayerSetup> =>
  ({ gear: { bag: emptyBag(), equipment: { ...starterEquipment(), rightHand } } });

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
export const stamina = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Stamina).value;
export const me = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Player);
export const blade = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, OneStrike);
export const swingOf = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Wielder).swing;

export const pressAt = (step: number, over: Partial<PlayerInputData>): Script => (s) => (s === step ? over : {});
export const both = (...scripts: Script[]): Script => (s) => Object.assign({}, ...scripts.map((f) => f(s)));
export const lineFrom = (step: number, line: PlayerInputData["line"]): Script => (s) => (s >= step ? { line } : {});
