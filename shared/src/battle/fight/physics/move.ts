/**
 * The physics step: gravity, then every body moves by its velocity, stopped by the floor and the wall. Bodies follow
 * the fight's rule rather than masses: an enemy shoves a player along, a player never pushes an enemy (though one
 * pinned against the wall holds it back). Dodging, knocked back or dead, a player passes through enemies, and
 * anyone through a dead enemy; enemies pass through each other, and players through players.
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

const solidToEnemies = (player: PlayerData, health: HealthData): boolean =>
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
    for (const [, player, body, health] of world.query(Player, Body, Health)) {
      if (mover.movePlayer(player, body, health, enemies, dt)) mover.holdBack(body, enemies);
    }
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
     * along), and are then pushed out of any overlap that's left. Returns whether they're solid to enemies.
     */
    movePlayer(player: PlayerData, body: BodyData, health: HealthData, enemies: BodyData[], dt: number): boolean {
      if (!solidToEnemies(player, health)) {
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
