import type { AttackKind, GuardSide, PlayerInputData } from "@infinite-tower/shared";
import type { Polled } from "../../core/actions.js";

const ATTACKS: Partial<Record<Polled["pressed"][number], AttackKind>> = { lightAttack: "light", heavyAttack: "heavy" };
const GUARDS: Partial<Record<Polled["pressed"][number], GuardSide>> = {
  guardLeft: "left", guardTop: "top", guardRight: "right",
};

export const pickedGuard = (polled: Polled, was: GuardSide): GuardSide =>
  polled.pressed.flatMap((action) => GUARDS[action] ?? []).at(-1) ?? was;

/** The keys (and mouse) -> the player's input, in world space, so the fight never needs to know about the camera. */
export function readPlayerInput(polled: Polled, yaw: number, guard: GuardSide | null, input: PlayerInputData): void {
  const { x: right, z: forward } = polled.move;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  // Camera forward = (sin, cos), right = (cos, -sin).
  input.moveX = right * cos + forward * sin;
  input.moveZ = -right * sin + forward * cos;
  input.aimX = sin;
  input.aimZ = cos;
  input.jump = polled.held.has("jump");
  input.attack = polled.pressed.flatMap((action) => ATTACKS[action] ?? []).at(-1) ?? null;
  // A tap shorter than a step still dodges.
  input.dodge = polled.pressed.includes("dodge") || polled.held.has("dodge");
  input.guardBreak = polled.pressed.includes("guardBreak") || polled.held.has("guardBreak");
  input.guard = guard;
}
