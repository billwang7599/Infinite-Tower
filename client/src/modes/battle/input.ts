import type { PlayerInputData, Strike, SwingDir } from "@infinite-tower/shared";
import type { Polled } from "../../core/actions.js";

type Pressed = Polled["pressed"][number];

const ATTACKS: Partial<Record<Pressed, Strike>> = { lightAttack: "light", heavyAttack: "heavy", stab: "stab" };
const AIMS: Partial<Record<Pressed, SwingDir>> = {
  aimTopLeft: "tlbr", aimTop: "tb", aimTopRight: "trbl", aimLeft: "lr", aimRight: "rl", aimBottomLeft: "bltr",
  aimBottom: "bt", aimBottomRight: "brtl",
};

const lastOf = <T>(polled: Polled, table: Partial<Record<Pressed, T>>): T | undefined =>
  polled.pressed.flatMap((action) => table[action] ?? []).at(-1);

export const pickedWay = (polled: Polled, was: SwingDir): SwingDir => lastOf(polled, AIMS) ?? was;

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
  input.attack = lastOf(polled, ATTACKS) ?? null;
  // A tap shorter than a step still dodges.
  const tapped = (action: Pressed) => polled.pressed.includes(action) || polled.held.has(action);
  input.dodge = tapped("dodge");
  input.kick = tapped("kick");
  input.block = tapped("block");
  input.way = way;
}
