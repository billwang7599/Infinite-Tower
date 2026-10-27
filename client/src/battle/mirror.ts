/**
 * Everyone but you, as the server's `battleState`s say: drawn INTERPOLATION_DELAY_STEPS behind the newest state,
 * between the two states around that moment, so they move smoothly however unevenly the states arrive. Nothing about
 * them is simulated here, and nothing is guessed ahead: they're where the server had them, a little late. Their
 * colliders go with them, so your prediction bumps into them where you see them.
 */
import {
  Body, Enemy, FIXED_DT, Health, Player, wrapAngle, type EnemySnap, type Entity, type FighterSnap, type PlayerSnap,
  type ServerMsgOf,
} from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";

/** Server steps (1/60 s) the drawing stays behind the newest state: one state's gap (3) and some slack for jitter. */
export const INTERPOLATION_DELAY_STEPS = 5;
/** Further than this (steps) from where the newest state puts it, the clock jumps there instead of easing. */
const MAX_CLOCK_DRIFT_STEPS = 12;
/** The share of the clock's drift taken out as each state arrives. */
const CLOCK_EASE = 0.1;
/** About a second of states. */
const MAX_KEPT_STATES = 20;

interface Kept { step: number; players: (PlayerSnap | null)[]; enemies: EnemySnap[] }

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class FightMirror {
  private readonly states: Kept[] = [];
  /** The server step being drawn (fractional), or null before the first state. */
  private clock: number | null = null;

  /** `seat`: yours, left to the prediction. */
  constructor(private readonly fight: Fight, private readonly seat: number) {}

  push({ step, players, enemies }: ServerMsgOf<"battleState">): void {
    const newest = this.states.at(-1);
    if (newest && step <= newest.step) return;
    this.states.push({ step, players, enemies });
    if (this.states.length > MAX_KEPT_STATES) this.states.shift();
    const target = step - INTERPOLATION_DELAY_STEPS;
    if (this.clock === null || Math.abs(target - this.clock) > MAX_CLOCK_DRIFT_STEPS) this.clock = target;
    else this.clock += (target - this.clock) * CLOCK_EASE;
  }

  /** One local step: draws everyone else at the clock's moment, then moves the clock on a step. */
  step(): void {
    const first = this.states[0], newest = this.states.at(-1);
    if (this.clock === null || !first || !newest) return;
    // Positions stop at the newest state; clocks (a state's time, a flash) run on with the drawn moment.
    const now = Math.max(first.step, this.clock), at = Math.min(newest.step, now);
    this.clock += 1;
    // `a`: the newest state at or before the moment; `b`: the next one (or `a` again, at the newest).
    let i = 0;
    while (i < this.states.length - 1 && this.states[i + 1]!.step <= at) i++;
    const a = this.states[i]!, b = this.states[Math.min(i + 1, this.states.length - 1)]!;
    const k = b.step > a.step ? (at - a.step) / (b.step - a.step) : 0;
    const since = (now - a.step) * FIXED_DT;
    this.fight.enemies.forEach((e, n) => {
      const from = a.enemies[n], to = b.enemies[n];
      if (from && to) this.drawEnemy(e, from, to, k, since);
    });
    this.fight.players.forEach((e, n) => {
      const from = a.players[n], to = b.players[n];
      if (n !== this.seat && from && to) this.drawPlayer(e, from, to, k, since);
    });
  }

  /** `since`: seconds from state `a` to the moment drawn; `k`: how far that is toward `b` (0..1). */
  private drawEnemy(e: Entity, a: EnemySnap, b: EnemySnap, k: number, since: number): void {
    this.drawFighter(e, a, b, k, since);
    const enemy = this.fight.world.require(e, Enemy);
    enemy.yaw = a.yaw + wrapAngle(b.yaw - a.yaw) * k;
    enemy.state = a.state;
    enemy.stateTime = a.stateTime + since;
  }

  private drawPlayer(e: Entity, a: PlayerSnap, b: PlayerSnap, k: number, since: number): void {
    this.drawFighter(e, a, b, k, since);
    const player = this.fight.world.require(e, Player);
    Object.assign(player, { action: a.action, actionTime: a.actionTime + since, grounded: a.grounded });
    player.actionDir = { x: a.dirX, z: a.dirZ };
    this.fight.world.require(e, Health).invuln = Math.max(0, a.invuln - since);
  }

  private drawFighter(e: Entity, a: FighterSnap, b: FighterSnap, k: number, since: number): void {
    const body = this.fight.world.require(e, Body);
    Object.assign(body.pos, { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) });
    Object.assign(body.vel, { x: lerp(a.vx, b.vx, k), y: lerp(a.vy, b.vy, k), z: lerp(a.vz, b.vz, k) });
    this.fight.physics.place(body.collider, body.pos);
    const health = this.fight.world.require(e, Health);
    health.hp = a.hp;
    health.flash = Math.max(0, a.flash - since);
  }
}
