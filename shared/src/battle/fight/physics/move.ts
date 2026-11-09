/**
 * The physics step: gravity, then every body moves by its velocity, stopped by the floor and the wall. Bodies follow
 * the fight's rule rather than masses: an enemy shoves a player along, a player never pushes an enemy (though one
 * pinned against the wall holds it back). Allies (enemy and enemy, player and player) shove each other apart evenly.
 * Dodging, knocked back or dead, a player passes through everyone, and anyone through a dead enemy.
 */
import type { System } from "../../../core/ecs.js";
import type { Vec3 } from "../../../core/math.js";
import {
  Body, Enemy, Health, Player, type BodyData, type HealthData, type PlayerData,
} from "../../components.js";
import { GRAVITY } from "../../player.js";
import type { ArenaPhysics, Contact } from "./arena-physics.js";

/** Bodies this close (m) count as touching: one can't move into the other. */
const TOUCH_MARGIN = 0.02;
/** Overlaps up to this deep (m) are left alone: what's left of a player pushed out exactly, give or take rounding. */
const OVERLAP_SLOP = 0.001;
/** Rounds of shoving allies apart each step, so one pushed into a third is pushed out of it too. */
const SHOVE_PASSES = 4;

const solid = (player: PlayerData, health: HealthData): boolean =>
  health.hp > 0 && player.action !== "dodge" && health.hitstun <= 0;

export function moveSystem(physics: ArenaPhysics): System {
  const mover = bodyMover(physics);
  return (world, dt) => {
    for (const [, body] of world.query(Body)) body.vel.y += GRAVITY * dt;

    // Enemies first: they go where they want, whoever is in the way...
    const enemies: BodyData[] = [];
    for (const [, , body, health] of world.query(Enemy, Body, Health)) {
      mover.travel(body, dt);
      if (health.hp > 0) enemies.push(body);
    }

    // ...then players.
    const players: BodyData[] = [];
    for (const [, player, body, health] of world.query(Player, Body, Health)) {
      if (!mover.movePlayer(player, body, health, enemies, dt)) continue;
      mover.holdBack(body, enemies);
      players.push(body);
    }
    // Last, so what a player held back is pushed out of its neighbours too.
    mover.shoveApart(enemies);
    mover.shoveApart(players);
    physics.step();
  };
}

function bodyMover(physics: ArenaPhysics) {
  /** Moves `body` by `delta`, as far as the floor and the wall let it. Returns how far it went. */
  const moveBody = (body: BodyData, delta: Vec3): Vec3 => {
    const moved = physics.move(body.collider, delta);
    Object.assign(body.pos, physics.position(body.collider));
    return moved;
  };
  /** Moves `body` by its velocity; what the floor and the wall stopped comes off the velocity. */
  const travel = (body: BodyData, dt: number) => {
    Object.assign(body.vel, scaled(moveBody(body, scaled(body.vel, dt)), 1 / dt));
  };
  /** Moves `body` out of what it overlaps (`touch`), without speeding it up. */
  const pushOut = (body: BodyData, touch: Contact) => moveBody(body, scaled(touch, -touch.distance));

  return {
    travel,
    /**
     * Moves a player. Touching an enemy, they go no faster toward it than it comes at them (so a shove carries them
     * along), and are then pushed out of any overlap that's left. Returns whether they have a body to bump.
     */
    movePlayer(player: PlayerData, body: BodyData, health: HealthData, enemies: BodyData[], dt: number): boolean {
      if (!solid(player, health)) {
        travel(body, dt);
        return false;
      }
      for (const enemy of enemies) {
        const touch = physics.contact(body.collider, body.pos, enemy.collider, TOUCH_MARGIN);
        if (touch) noFasterInto(body.vel, enemy.vel, touch);
      }
      travel(body, dt);
      for (const enemy of enemies) {
        const touch = physics.contact(body.collider, body.pos, enemy.collider);
        if (touch && touch.distance < 0) pushOut(body, touch);
      }
      return true;
    },
    /**
     * Allies overlapping each take half the way out (one held by the wall, the other takes the rest), so one walking
     * into another pushes it along at half its pace.
     */
    shoveApart(bodies: BodyData[]): void {
      for (let pass = 0; pass < SHOVE_PASSES; pass++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i]!, b = bodies[j]!;
            const touch = physics.contact(a.collider, a.pos, b.collider);
            const across = touch && Math.hypot(touch.x, touch.z);
            if (!touch || !across || touch.distance > -OVERLAP_SLOP) continue;
            const x = (touch.x / across) * -touch.distance, z = (touch.z / across) * -touch.distance;
            const movedA = moveBody(a, { x: x / 2, y: 0, z: z / 2 });
            const movedB = moveBody(b, { x: movedA.x - x, y: 0, z: movedA.z - z });
            moveBody(a, { x: x - movedA.x + movedB.x, y: 0, z: z - movedA.z + movedB.z });
          }
        }
      }
    },
    /** Pinned against the wall, the player holds the enemy back instead. */
    holdBack(body: BodyData, enemies: BodyData[]): void {
      for (const enemy of enemies) {
        const touch = physics.contact(enemy.collider, enemy.pos, body.collider);
        if (!touch || touch.distance > -OVERLAP_SLOP) continue;
        pushOut(enemy, touch);
        noFasterInto(enemy.vel, body.vel, touch);
      }
    },
  };
}

const scaled = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });

/** Takes out of `vel` any speed toward the thing it touches (`touch` points away from it) beyond that thing's own. */
function noFasterInto(vel: Vec3, otherVel: Vec3, touch: Contact): void {
  const closing = (vel.x - otherVel.x) * touch.x + (vel.y - otherVel.y) * touch.y + (vel.z - otherVel.z) * touch.z;
  if (closing >= 0) return;
  vel.x -= closing * touch.x;
  vel.y -= closing * touch.y;
  vel.z -= closing * touch.z;
}
