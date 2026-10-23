/**
 * The fight itself still runs in the browser, so the server can't verify every hit yet. It does
 * refuse wins that are physically impossible: faster than the player's best damage output allows.
 */
import { PLAYER, type BoarDef } from "@infinite-tower/shared";

/** Shortest possible kill: every slash chained back to back, every one landing. */
export function minKillSeconds(enemy: BoarDef): number {
  const s = PLAYER.slash;
  const slashes = Math.ceil(enemy.maxHp / s.damage);
  return (slashes - 1) * s.chainAfter + s.windup;
}

/** `elapsed` is measured by the server, from sending the encounter to receiving the result. */
export function isPlausibleWin(enemy: BoarDef, elapsed: number): boolean {
  return elapsed >= minKillSeconds(enemy) * 0.9;
}
