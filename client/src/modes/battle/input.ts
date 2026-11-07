import type { BodyData, FighterData, PlayerInputData, Strike, SwingDir, Vec2, Vec3 } from "@infinite-tower/shared";
import { entersAt, landsAt } from "@infinite-tower/shared/fight";
import type { Flick, Polled } from "../../core/actions.js";

type Pressed = Polled["pressed"][number];

const ATTACKS: Partial<Record<Pressed, Strike>> = { lightAttack: "light", heavyAttack: "heavy", stab: "stab" };
// Straight down aims nothing: there is no upward swing.
const FLICK_WAYS: Record<Flick, SwingDir | null> = {
  right: "rl", downRight: "brtl", down: null, downLeft: "bltr", left: "lr", upLeft: "tlbr", up: "tb", upRight: "trbl",
};

export const pickedWay = (polled: Polled, was: SwingDir): SwingDir =>
  polled.flicks.flatMap((flick) => FLICK_WAYS[flick] ?? []).at(-1) ?? was;

export interface Aimed { body: BodyData; fighter: FighterData }

// Nearer than this ahead of the player, the crosshair's spot gives no clear way to aim.
export const CROSSHAIR_MIN_M = 1;

export function crosshairAim(eye: Vec3, at: Vec3, from: Vec3, foes: readonly Aimed[], wallM: number): Vec2 | null {
  const lineM = Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z), flatM = Math.hypot(at.x - eye.x, at.z - eye.z);
  if (flatM < 1e-6) return null;
  // The eye is inside the wall, so no line in the arena is longer than its diameter.
  const scale = (2 * wallM) / lineM, ahead = { x: (at.x - eye.x) / flatM, z: (at.z - eye.z) / flatM };
  const d = { x: (at.x - eye.x) * scale, y: (at.y - eye.y) * scale, z: (at.z - eye.z) * scale };
  const shares = [landsAt(eye, d, wallM), ...foes.map(({ body, fighter }) => entersAt(eye, d, body, fighter, 0))];
  let aim: Vec2 | null = null, aimShare = Infinity;
  for (const share of shares) {
    if (share === null || share >= aimShare) continue;
    const dx = eye.x + d.x * share - from.x, dz = eye.z + d.z * share - from.z;
    if (dx * ahead.x + dz * ahead.z < CROSSHAIR_MIN_M) continue;
    aim = { x: dx / Math.hypot(dx, dz), z: dz / Math.hypot(dx, dz) };
    aimShare = share;
  }
  return aim;
}

/** The keys (and mouse) -> the player's input, in world space, so the fight never needs to know about the camera. */
export function readPlayerInput(
  polled: Polled, yaw: number, way: SwingDir, input: PlayerInputData, aim: Vec2 | null = null,
): void {
  const { x: right, z: forward } = polled.move;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  // Camera forward = (sin, cos), right = (cos, -sin).
  input.moveX = right * cos + forward * sin;
  input.moveZ = -right * sin + forward * cos;
  input.aimX = aim?.x ?? sin;
  input.aimZ = aim?.z ?? cos;
  input.jump = polled.held.has("jump");
  input.attack = polled.pressed.flatMap((action) => ATTACKS[action] ?? []).at(-1) ?? null;
  input.attackHeld = polled.held.has("lightAttack");
  // A tap shorter than a step still dodges.
  const tapped = (action: Pressed) => polled.pressed.includes(action) || polled.held.has(action);
  input.dodge = tapped("dodge");
  input.block = tapped("block");
  input.way = way;
}
