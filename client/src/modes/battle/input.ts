import type { PlayerInputData, Strike, SwingDir } from "@infinite-tower/shared";
import type { Flick, Polled } from "../../core/actions.js";

type Pressed = Polled["pressed"][number];

const ATTACKS: Partial<Record<Pressed, Strike>> = { lightAttack: "light", heavyAttack: "heavy", stab: "stab" };
// Straight down aims nothing: there is no upward swing.
const FLICK_WAYS: Record<Flick, SwingDir | null> = {
  right: "rl", downRight: "brtl", down: null, downLeft: "bltr", left: "lr", upLeft: "tlbr", up: "tb", upRight: "trbl",
};

export const pickedWay = (polled: Polled, was: SwingDir): SwingDir =>
  polled.flicks.flatMap((flick) => FLICK_WAYS[flick] ?? []).at(-1) ?? was;

/** The keys (and mouse) -> the player's input, in world space, so the fight never needs to know about the camera. */
export function readPlayerInput(polled: Polled, yaw: number, way: SwingDir, input: PlayerInputData): void {
  const { x: right, z: forward } = polled.move;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  // Camera forward = (sin, cos), right = (cos, -sin).
  input.moveX = right * cos + forward * sin;
  input.moveZ = -right * sin + forward * cos;
  input.aimX = sin;
  input.aimZ = cos;
  input.jump = polled.held.has("jump");
  input.attack = polled.pressed.flatMap((action) => ATTACKS[action] ?? []).at(-1) ?? null;
  input.attackHeld = polled.held.has("lightAttack");
  // A tap shorter than a step still dodges.
  const tapped = (action: Pressed) => polled.pressed.includes(action) || polled.held.has(action);
  input.dodge = tapped("dodge");
  input.block = tapped("block");
  input.way = way;
}
