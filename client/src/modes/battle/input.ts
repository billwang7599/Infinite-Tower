import {
  raised, type GuardSide, type Line, type Perilous, type PlayerInputData, type Strike, type SwingDir,
} from "@infinite-tower/shared";
import type { Polled } from "../../core/actions.js";

type Pressed = Polled["pressed"][number];

const ATTACKS: Partial<Record<Pressed, Strike>> = {
  lightAttack: "light", heavyAttack: "heavy", stab: "stab", thrust: "light", beat: "heavy",
};
const PERILOUS: Partial<Record<Pressed, Perilous>> = { perilousThrust: "thrust", perilousSweep: "sweep" };
const GUARDS: Partial<Record<Pressed, GuardSide>> = { guardLeft: "left", guardTop: "top", guardRight: "right" };
const AIMS: Partial<Record<Pressed, SwingDir>> = {
  aimTopLeft: "tlbr", aimTop: "tb", aimTopRight: "trbl", aimLeft: "lr", aimRight: "rl", aimBottomLeft: "bltr",
  aimBottom: "bt", aimBottomRight: "brtl",
};

const lastOf = <T>(polled: Polled, table: Partial<Record<Pressed, T>>): T | undefined =>
  polled.pressed.flatMap((action) => table[action] ?? []).at(-1);

export const pickedGuard = (polled: Polled, was: GuardSide): GuardSide => lastOf(polled, GUARDS) ?? was;
export const pickedWay = (polled: Polled, was: SwingDir): SwingDir => lastOf(polled, AIMS) ?? was;
export const pickedLine = (polled: Polled, was: Line): Line => polled.pressed.reduce(
  (line, action) => (action === "raiseLine" ? raised(line, 1) : action === "lowerLine" ? raised(line, -1) : line), was,
);

/** The keys (and mouse) -> the player's input, in world space, so the fight never needs to know about the camera. */
export function readPlayerInput(
  polled: Polled, yaw: number, stance: { guard: GuardSide | null; way: SwingDir | null; line: Line | null },
  input: PlayerInputData,
): void {
  const { x: right, z: forward } = polled.move;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  // Camera forward = (sin, cos), right = (cos, -sin).
  input.moveX = right * cos + forward * sin;
  input.moveZ = -right * sin + forward * cos;
  input.aimX = sin;
  input.aimZ = cos;
  input.jump = polled.held.has("jump");
  input.attack = lastOf(polled, ATTACKS) ?? null;
  input.perilous = lastOf(polled, PERILOUS) ?? null;
  // A tap shorter than a step still dodges.
  const tapped = (action: Pressed) => polled.pressed.includes(action) || polled.held.has(action);
  input.dodge = tapped("dodge");
  input.guardBreak = tapped("guardBreak");
  input.kick = tapped("kick");
  input.block = tapped("block") || tapped("guard");
  input.guard = stance.guard;
  input.way = stance.way;
  input.line = stance.line;
}
