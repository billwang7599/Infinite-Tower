/**
 * Fights, from the server's side. The fight itself still runs in the browser, so the server can't
 * verify every hit yet; it picks the enemy, times the fight, and refuses wins that are physically
 * impossible (faster than the player's best damage output allows).
 */
import {
  clamp, fullVitals, physicalDamage, PLAYER, type EnemyDef, type Entity, type Inventory, type Stats, type Vitals,
} from "@infinite-tower/shared";
import { addItems, rollDrops } from "../content/drops.js";
import { ENEMIES, type EnemyId } from "../content/enemies.js";
import type { Session } from "./session.js";

export interface Encounter {
  /** The actor that started it (removed if you win), or null for tall grass. */
  source: Entity | null;
  enemyId: EnemyId;
  enemy: EnemyDef;
  startedAt: number;
  /** What the player came in with. */
  vitals: Vitals;
}

export function startEncounter(session: Session, source: Entity | null, enemyId: EnemyId): void {
  const enemy = ENEMIES[enemyId];
  const { vitals } = session;
  session.encounter = { source, enemyId, enemy, startedAt: performance.now(), vitals };
  session.resetWalk(0);
  session.conn.send({
    t: "encounter", source, enemy, arena: session.currentLevel.arena, me: session.playerPos(), vitals, stats: session.stats,
  });
}

/** The client left a decided fight claiming `claimedWin`, with `claimed` HP and stamina left. */
export function endEncounter(session: Session, claimedWin: boolean, claimed: Vitals): void {
  const fight = session.encounter;
  if (!fight) return;
  const elapsed = (performance.now() - fight.startedAt) / 1000;
  const accepted = !claimedWin || isPlausibleWin(fight.enemy, session.stats, elapsed);
  const won = claimedWin && accepted;
  const { world } = session;
  let loot: Inventory = {};

  if (won) {
    loot = rollDrops(fight.enemyId, Math.random);
    session.inventory = addItems(session.inventory, loot);
    session.wins++;
    if (fight.source !== null && world.isAlive(fight.source)) world.destroy(fight.source); // the spawner replaces it
    world.flush();
    session.vitals = vitalsAfterWin(fight.vitals, claimed, session.stats);
  } else {
    session.placePlayer(session.currentLevel.spawn); // you wake up back at the start, rested
    session.vitals = fullVitals(session.stats);
  }
  session.resetWalk(session.currentLevel.safeTime);
  session.encounter = null;
  session.save();
  session.conn.send({
    t: "battleResult", won, accepted, me: session.playerPos(), wins: session.wins, vitals: session.vitals,
    loot, inventory: session.inventory,
  });
}

/**
 * The fight runs in the browser, so the server can only bound what it's told: nothing heals during a fight,
 * and a winner is still standing.
 */
function vitalsAfterWin(before: Vitals, claimed: Vitals, stats: Stats): Vitals {
  return { hp: clamp(claimed.hp, 1, before.hp), stamina: clamp(claimed.stamina, 0, stats.stamina) };
}

/** Shortest possible kill: every slash chained back to back, every one landing, at the player's strength. */
export function minKillSeconds(enemy: EnemyDef, stats: Stats): number {
  const s = PLAYER.slash;
  const slashes = Math.ceil(enemy.maxHp / physicalDamage(s.damage, stats));
  return (slashes - 1) * s.chainAfter + s.windup;
}

/** `elapsed` is measured by the server, from sending the encounter to receiving the result. */
export function isPlausibleWin(enemy: EnemyDef, stats: Stats, elapsed: number): boolean {
  return elapsed >= minKillSeconds(enemy, stats) * 0.9;
}
