/** Entity factories: the only place that knows how a "player" or "floor" is assembled from components. */
import {
  Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, TransformNode, Vector3,
} from "@babylonjs/core";
import {
  type Entity, type Vec3, Player, PlayerInput, LocalPlayer, Platform, PLAYER, TOWER, generateFloor,
} from "@infinite-tower/shared";
import { Body, Meshes, SpriteView } from "./components.js";
import { Layer, type GameContext } from "./context.js";
import { zoneIndex } from "./materials.js";

const PLATFORM_THICKNESS = 0.5;

export function spawnPlayer(ctx: GameContext, name: string, at: Vec3, local: boolean): Entity {
  const { world, scene, materials } = ctx;
  const e = world.spawn();

  // Physics capsule (invisible). Havok owns its transform.
  const capsule = MeshBuilder.CreateCapsule(`player-${e}`, { radius: PLAYER.radius, height: PLAYER.height }, scene);
  capsule.position.set(at.x, at.y + PLAYER.height / 2, at.z);
  capsule.isVisible = false;
  const aggregate = new PhysicsAggregate(capsule, PhysicsShapeType.CAPSULE, { mass: 1, friction: 0, restitution: 0 }, scene);
  aggregate.body.setMassProperties({ inertia: Vector3.Zero() }); // never tip over
  aggregate.shape.filterMembershipMask = Layer.Player;
  aggregate.shape.filterCollideMask = Layer.Platform | Layer.Wall; // players pass through each other
  world.add(e, Body, { aggregate, mesh: capsule });

  // 2D sprite: a Y-billboarded quad, child of the capsule so it follows the body.
  const root = new TransformNode(`sprite-root-${e}`, scene);
  root.parent = capsule;
  root.position.y = -PLAYER.height / 2; // pivot at the feet, for squash/stretch
  const plane = MeshBuilder.CreatePlane(`sprite-${e}`, { width: 1.2, height: 1.8 }, scene);
  plane.parent = root;
  plane.position.y = 0.9;
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.material = materials.player;

  const shadow = MeshBuilder.CreateGround(`shadow-${e}`, { width: 1.1, height: 0.7 }, scene);
  shadow.material = materials.shadow;
  shadow.isPickable = false;
  world.add(e, SpriteView, { root, plane, shadow, facing: 1, walkPhase: 0, stretch: 1 });

  world.add(e, PlayerInput, { moveX: 0, moveZ: 0, jump: false });
  world.add(e, Player, {
    name, bestFloor: 0, spawnPoint: { ...at }, grounded: false, airTime: 0, jumpBuffer: 0, jumpHeld: false,
  });
  if (local) world.add(e, LocalPlayer, true);
  return e;
}

/** One floor = its platforms (static bodies) plus a slice of tower wall. Returns all entities created. */
export function spawnFloor(ctx: GameContext, floor: number): Entity[] {
  const { world, scene, materials, seed } = ctx;
  const entities: Entity[] = [];
  const zone = zoneIndex(floor);
  const isCheckpoint = floor > 0 && floor % 10 === 0;

  generateFloor(seed, floor).forEach((p, i) => {
    const e = world.spawn();
    const box = MeshBuilder.CreateBox(`platform-${floor}-${i}`, { width: p.width, depth: p.depth, height: PLATFORM_THICKNESS }, scene);
    box.position.set(p.x, p.y - PLATFORM_THICKNESS / 2, p.z);
    box.material = isCheckpoint && i === 0 ? materials.checkpoint : materials.platform[zone]!;
    const aggregate = new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0, friction: 0.6, restitution: 0 }, scene);
    aggregate.shape.filterMembershipMask = Layer.Platform;
    box.freezeWorldMatrix();
    world.add(e, Body, { aggregate, mesh: box });
    world.add(e, Platform, { floor });
    entities.push(e);
  });

  // Wall slice for this floor: a decorative back wall plus solid side walls.
  const w = TOWER.halfWidth;
  const h = TOWER.floorHeight;
  const y = floor * h + h / 2 - PLATFORM_THICKNESS;
  const wallMat = materials.wall[zone]!;

  const decor: Mesh[] = [];
  const back = MeshBuilder.CreatePlane(`wall-back-${floor}`, { width: w * 2 + 2, height: h }, scene);
  back.position.set(0, y, w * 0.5 + 1.2);
  back.material = wallMat;
  decor.push(back);

  // A glowing window every few floors, alternating sides.
  if (floor % 3 === 1) {
    const win = MeshBuilder.CreatePlane(`window-${floor}`, { width: 1, height: 1.4 }, scene);
    win.position.set((floor % 2 === 0 ? -1 : 1) * w * 0.6, y + 0.2, w * 0.5 + 1.15);
    win.material = materials.window;
    decor.push(win);
  }
  for (const m of decor) m.freezeWorldMatrix();
  const de = world.spawn();
  world.add(de, Meshes, { meshes: decor });
  entities.push(de);

  for (const side of [-1, 1]) {
    const wall = MeshBuilder.CreateBox(`wall-${side}-${floor}`, { width: 1, height: h, depth: w * 1.5 }, scene);
    wall.position.set(side * (w + 0.5), y, 0);
    wall.material = materials.wallSide[zone]!;
    const aggregate = new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0, friction: 0 }, scene);
    aggregate.shape.filterMembershipMask = Layer.Wall;
    wall.freezeWorldMatrix();
    const we = world.spawn();
    world.add(we, Body, { aggregate, mesh: wall });
    entities.push(we);
  }

  return entities;
}

/** Move a dynamic body instantly (respawn). Havok owns the transform, so we push it for one step. */
export function teleport(ctx: GameContext, e: Entity, to: Vec3): void {
  const body = ctx.world.get(e, Body);
  if (!body) return;
  body.mesh.position.set(to.x, to.y + PLAYER.height / 2, to.z);
  body.aggregate.body.setLinearVelocity(Vector3.Zero());
  body.aggregate.body.disablePreStep = false;
  ctx.scene.onAfterPhysicsObservable.addOnce(() => {
    body.aggregate.body.disablePreStep = true;
  });
}
