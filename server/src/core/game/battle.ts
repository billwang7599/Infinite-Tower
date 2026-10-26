/**
 * Battles, from the server's side. The fight itself still runs in the browser, so the server can't
 * verify every hit yet; it picks the enemy, times the fight, and refuses wins that are physically
 * impossible (faster than the player's best damage output allows).
 */
import {
  clamp, physicalDamage, PLAYER, type EnemyDef, type Entity, type Stats, type Vitals,
} from "@infinite-tower/shared";
import { rollDrops } from "../content/drops.js";
import { ENEMIES, type EnemyId } from "../content/enemies.js";
import { fullVitals } from "../content/player.js";
import { packLoot } from "./inventory.js";
import type { GameSession } from "./session.js";

export interface Battle {
  /** The actor that started it (removed if you win), or null for tall grass. */
  source: Entity | null;
  enemyId: EnemyId;
  /** performance.now() when the encounter was sent. */
  startedAtMs: number;
  /** What the player came in with. */
  vitals: Vitals;
}

/** A win faster than this share of the fastest possible kill is refused: a little slack, so a perfect fight passes. */
const MIN_KILL_TIME_SHARE = 0.9;

export function startBattle(session: GameSession, source: Entity | null, enemyId: EnemyId): void {
  const { field, vitals } = session;
  session.battle = { source, enemyId, startedAtMs: performance.now(), vitals };
  field.resetWalk(0);
  session.link.send({
    t: "encounter", source, enemy: ENEMIES[enemyId], arena: field.level.arena, me: field.playerPos(), vitals,
    stats: session.stats, burden: session.burden,
  });
}

/** The client left a decided fight claiming `claimedWin`, with `claimed` HP and stamina left. */
export function settleBattle(session: GameSession, claimedWin: boolean, claimed: Vitals): void {
  const battle = session.battle;
  if (!battle) return;
  const fightTime = (performance.now() - battle.startedAtMs) / 1000;
  const accepted = !claimedWin || isPlausibleWin(ENEMIES[battle.enemyId], session.stats, fightTime);
  const won = claimedWin && accepted;
  const { field } = session;
  const loot = won ? rollDrops(battle.enemyId, field.rng) : {};
  const packed = packLoot(session.bag, loot);

  if (won) {
    session.bag = packed.bag;
    session.wins++;
    // The spawner replaces it.
    if (battle.source !== null && field.world.isAlive(battle.source)) field.world.destroy(battle.source);
    field.world.flush();
    session.vitals = vitalsAfterWin(battle.vitals, claimed, session.stats);
  } else {
    field.place(field.level.spawn); // you wake up back at the start, rested
    session.vitals = fullVitals(session.stats);
  }
  field.resetWalk(field.level.safeTime);
  session.battle = null;
  session.save();
  session.link.send({
    t: "battleResult", won, accepted, me: field.playerPos(), wins: session.wins, vitals: session.vitals,
    loot, leftBehind: packed.left, bag: session.bag,
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
function minKillTime(enemy: EnemyDef, stats: Stats): number {
  const s = PLAYER.slash;
  const slashes = Math.ceil(enemy.maxHp / physicalDamage(s.damage, stats));
  return (slashes - 1) * s.chainAfter + s.windup;
}

/** `fightTime` is measured by the server, from sending the encounter to receiving the result. */
function isPlausibleWin(enemy: EnemyDef, stats: Stats, fightTime: number): boolean {
  return fightTime >= minKillTime(enemy, stats) * MIN_KILL_TIME_SHARE;
}
