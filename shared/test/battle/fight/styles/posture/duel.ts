import {
  emptyBag, Health, Player, Posture, Stamina, starterEquipment, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, type FightEvent, type PlayerSetup } from "@infinite-tower/shared/fight";
import { ARENA, input, player } from "../../fixtures.js";

export const GAP_M = 1.6;

export const pvp = (first: Partial<PlayerSetup> = {}, second: Partial<PlayerSetup> = {}) => new Fight({
  arena: ARENA, duel: true, enemies: [], style: "posture",
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
export const stamina = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Stamina).value;
export const me = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Player);
export const postureOf = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Posture);

export const pressAt = (step: number, over: Partial<PlayerInputData>): Script => (s) => (s === step ? over : {});
export const guardFrom = (step: number): Script => (s) => ({ block: s >= step });

export function landsAt(step: number, over: Partial<PlayerInputData> = { attack: "light" }): number {
  const fight = pvp();
  for (;;) {
    const events = play(fight, 1, pressAt(step, over));
    if (events.some((e) => e.type === "hit")) return fight.steps;
  }
}
