/**
 * Fights, from the server's side. The fight itself still runs in the browser, so the server can't
 * verify every hit yet; it picks the enemy, times the fight, and refuses wins that are physically
 * impossible (faster than the player's best damage output allows).
 */
import { clamp, fullVitals, PLAYER, type EnemyDef, type Entity, type Vitals } from "@infinite-tower/shared";
import { ENEMIES, type EnemyId } from "../content/enemies.js";
import type { Session } from "./session.js";

export interface Encounter {
  /** The actor that started it (removed if you win), or null for tall grass. */
  source: Entity | null;
  enemy: EnemyDef;
  startedAt: number;
  /** What the player came in with. */
  vitals: Vitals;
}

export function startEncounter(session: Session, source: Entity | null, enemyId: EnemyId): void {
  const enemy = ENEMIES[enemyId];
  const { vitals } = session;
  session.encounter = { source, enemy, startedAt: performance.now(), vitals };
  session.resetWalk(0);
  session.conn.send({ t: "encounter", source, enemy, arena: session.currentLevel.arena, me: session.playerPos(), vitals });
}

/** The client left a decided fight claiming `claimedWin`, with `claimed` HP and stamina left. */
export function endEncounter(session: Session, claimedWin: boolean, claimed: Vitals): void {
  const fight = session.encounter;
  if (!fight) return;
  const elapsed = (performance.now() - fight.startedAt) / 1000;
  const accepted = !claimedWin || isPlausibleWin(fight.enemy, elapsed);
  const won = claimedWin && accepted;
  const { world } = session;

  if (won) {
    session.wins++;
    if (fight.source !== null && world.isAlive(fight.source)) world.destroy(fight.source); // the spawner replaces it
    world.flush();
    session.vitals = vitalsAfterWin(fight.vitals, claimed);
  } else {
    session.placePlayer(session.currentLevel.spawn); // you wake up back at the start, rested
    session.vitals = fullVitals();
  }
  session.resetWalk(session.currentLevel.safeTime);
  session.encounter = null;
  session.save();
  session.conn.send({ t: "battleResult", won, accepted, me: session.playerPos(), wins: session.wins, vitals: session.vitals });
}

/**
 * The fight runs in the browser, so the server can only bound what it's told: nothing heals during a fight,
 * and a winner is still standing.
 */
function vitalsAfterWin(before: Vitals, claimed: Vitals): Vitals {
  return { hp: clamp(claimed.hp, 1, before.hp), stamina: clamp(claimed.stamina, 0, PLAYER.maxStamina) };
}

/** Shortest possible kill: every slash chained back to back, every one landing. */
export function minKillSeconds(enemy: EnemyDef): number {
  const s = PLAYER.slash;
  const slashes = Math.ceil(enemy.maxHp / s.damage);
  return (slashes - 1) * s.chainAfter + s.windup;
}

/** `elapsed` is measured by the server, from sending the encounter to receiving the result. */
export function isPlausibleWin(enemy: EnemyDef, elapsed: number): boolean {
  return elapsed >= minKillSeconds(enemy) * 0.9;
}
