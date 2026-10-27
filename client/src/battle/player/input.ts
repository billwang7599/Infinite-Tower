import { ATTACK_KINDS, type AttackKind, type PlayerInputData } from "@infinite-tower/shared";
import type { Polled } from "../../core/actions.js";

const isAttack = (action: Polled["pressed"][number]): action is AttackKind =>
  (ATTACK_KINDS as readonly string[]).includes(action);

/** The keys (and mouse) -> the player's input, in world space, so the fight never needs to know about the camera. */
export function readPlayerInput(polled: Polled, yaw: number, input: PlayerInputData): void {
  const { x: right, z: forward } = polled.move;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  // Camera forward = (sin, cos), right = (cos, -sin).
  input.moveX = right * cos + forward * sin;
  input.moveZ = -right * sin + forward * cos;
  input.aimX = sin;
  input.aimZ = cos;
  input.jump = polled.held.has("jump");
  input.attack = polled.pressed.filter(isAttack).at(-1) ?? null;
  // A tap shorter than a step still dodges.
  input.dodge = polled.pressed.includes("dodge") || polled.held.has("dodge");
  input.block = polled.held.has("block");
}
