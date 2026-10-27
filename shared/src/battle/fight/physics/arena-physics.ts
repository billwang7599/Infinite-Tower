/**
 * One fight's physics world: the floor, a ring of wall and a collider per fighter. Rapier simulates nothing: code
 * moves the fighters (move.ts), and Rapier answers how far they get, where two bodies touch, and ray casts.
 */
import type {
  Collider, ColliderDesc, KinematicCharacterController, Ray, World as RapierWorld,
} from "@dimforge/rapier3d-deterministic-compat";
import type { Vec3 } from "../../../core/math.js";
import { FIXED_DT } from "../../../core/time.js";
import { rapier } from "./init.js";

/** Collision layers (bit masks). Through Rapier, fighters only bump into the floor and the wall. */
export const Layer = { Ground: 1 << 0, Wall: 1 << 1, Player: 1 << 2, Enemy: 1 << 3 } as const;
const ALL_LAYERS = 0xffff;
/** Rapier's collision groups: what it is in the high 16 bits, what it collides with in the low 16. */
const groups = (memberOf: number, collidesWith: number): number => (memberOf << 16) | collidesWith;
const WALLS = groups(ALL_LAYERS, Layer.Wall);
const FLOOR = groups(ALL_LAYERS, Layer.Ground);

/** The gap the character controller keeps between a body and what it stands on or leans against (m). */
const SKIN = 0.01;
/** The floor: a slab this wide (m), its top at y = 0. */
const FLOOR_SIZE = 120;
/** The wall: this many boxes in a ring just outside the arena's radius. */
const WALL = { segments: 40, height: 4, thickness: 1 } as const;
const NO_TURN = { x: 0, y: 0, z: 0, w: 1 };
const ACROSS: Vec3 = { x: 1, y: 0, z: 1 };
const UP_DOWN: Vec3 = { x: 0, y: 1, z: 0 };

/** Two bodies touching: the way out of the other one (a unit vector), and how far apart (negative: overlapping). */
export interface Contact { x: number; y: number; z: number; distance: number }

export class ArenaPhysics {
  private readonly world: RapierWorld;
  private readonly mover: KinematicCharacterController;
  private readonly ray: Ray;

  constructor(arenaRadius: number) {
    const R = rapier();
    this.world = new R.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = FIXED_DT;
    this.mover = this.world.createCharacterController(SKIN);
    this.ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

    const half = FLOOR_SIZE / 2;
    this.add(R.ColliderDesc.cuboid(half, 0.5, half).setTranslation(0, -0.5, 0), groups(Layer.Ground, ALL_LAYERS));
    // Each box's thickness points at the center, so their inner faces make a ring of flat walls at the radius.
    const ringRadius = arenaRadius + WALL.thickness / 2;
    const segmentLength = (2 * Math.PI * ringRadius) / WALL.segments + 0.2;
    for (let i = 0; i < WALL.segments; i++) {
      const a = (i / WALL.segments) * Math.PI * 2;
      const wall = R.ColliderDesc.cuboid(segmentLength / 2, WALL.height / 2, WALL.thickness / 2)
        .setTranslation(Math.sin(a) * ringRadius, WALL.height / 2, Math.cos(a) * ringRadius)
        .setRotation({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });
      this.add(wall, groups(Layer.Wall, ALL_LAYERS));
    }
    this.step();
  }

  /** A standing capsule centered at `center`, `halfHeight` from the center to each cap's middle. Returns its handle. */
  addCapsule(center: Vec3, halfHeight: number, radius: number, layer: number): number {
    const desc = rapier().ColliderDesc.capsule(halfHeight, radius).setTranslation(center.x, center.y, center.z);
    return this.add(desc, groups(layer, Layer.Ground | Layer.Wall));
  }

  addBall(center: Vec3, radius: number, layer: number): number {
    const desc = rapier().ColliderDesc.ball(radius).setTranslation(center.x, center.y, center.z);
    return this.add(desc, groups(layer, Layer.Ground | Layer.Wall));
  }

  /** The collider's center. */
  position(handle: number): Vec3 {
    const { x, y, z } = this.collider(handle).translation();
    return { x, y, z };
  }

  /** Puts a collider's center at `center`, through anything (loading a fight's state). */
  place(handle: number, center: Vec3): void {
    this.collider(handle).setTranslation({ x: center.x, y: center.y, z: center.z });
  }

  /**
   * Moves a collider by `delta`, stopped and slid along by the floor and the wall. Returns how far it went. Across
   * the floor first, against the wall only, then up or down, against the floor only: a body resting on the floor
   * always grazes it, and sweeping both at once sometimes catches on it and stops dead. The floor is flat and the
   * wall upright, so each sweep keeps only its own axes (dropping the controller's sub-millimetre nudges).
   */
  move(handle: number, delta: Vec3): Vec3 {
    const across = this.sweep(handle, { x: delta.x, y: 0, z: delta.z }, WALLS, ACROSS);
    const upDown = this.sweep(handle, { x: 0, y: delta.y, z: 0 }, FLOOR, UP_DOWN);
    return { x: across.x, y: upDown.y, z: across.z };
  }

  /**
   * Where collider `handle`, if it were centered at `at`, would touch collider `other`: the way out of `other` and
   * how far apart they'd be (negative: overlapping by that much). Null if more than `margin` apart.
   */
  contact(handle: number, at: Vec3, other: number, margin = 0): Contact | null {
    const found = this.collider(other).contactShape(this.collider(handle).shape, at, NO_TURN, margin);
    if (!found) return null;
    const out = found.normal1;
    return { x: out.x, y: out.y, z: out.z, distance: found.distance };
  }

  /** How far below (x, y, z) the floor is, looking down at most `maxDist`; null if it's farther. */
  floorBelow(x: number, y: number, z: number, maxDist: number): number | null {
    this.ray.origin = { x, y, z };
    return this.world.castRay(this.ray, maxDist, true, undefined, FLOOR)?.timeOfImpact ?? null;
  }

  /** Ends a step: files the moved colliders where the next step's queries look for them. */
  step(): void {
    this.world.step();
  }

  /** As bytes, to compare two fights. */
  snapshot(): Uint8Array {
    return this.world.takeSnapshot();
  }

  /** Frees the WebAssembly memory. Don't use it after. */
  free(): void {
    this.world.free();
  }

  /** One sweep of the character controller against `against`, keeping the movement's `axes` (1 kept, 0 dropped). */
  private sweep(handle: number, delta: Vec3, against: number, axes: Vec3): Vec3 {
    const collider = this.collider(handle);
    this.mover.computeColliderMovement(collider, delta, undefined, against);
    const found = this.mover.computedMovement();
    const moved = { x: found.x * axes.x, y: found.y * axes.y, z: found.z * axes.z };
    const at = collider.translation();
    collider.setTranslation({ x: at.x + moved.x, y: at.y + moved.y, z: at.z + moved.z });
    return moved;
  }

  private add(desc: ColliderDesc, collisionGroups: number): number {
    return this.world.createCollider(desc.setCollisionGroups(collisionGroups)).handle;
  }

  private collider(handle: number): Collider {
    return this.world.getCollider(handle);
  }
}
