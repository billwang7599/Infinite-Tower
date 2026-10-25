/** Assembles the arena player from components: Havok capsule, billboard sprite, blob shadow, slash trail. */
import { Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, TransformNode, Vector3 } from "@babylonjs/core";
import {
  type Entity, type Stats, type Vec3, type Vitals, Player, PlayerInput, LocalPlayer, Health, Stamina, Fighter, FighterStats, PLAYER,
} from "@infinite-tower/shared";
import { Body } from "../components.js";
import { Layer, type BattleContext } from "../context.js";
import { PlayerSprite } from "./components.js";

export function spawnPlayer(ctx: BattleContext, at: Vec3, vitals: Vitals, stats: Stats, local: boolean): Entity {
  const { world, scene, materials } = ctx;
  const e = world.spawn();

  // Physics capsule (invisible). Havok owns its transform.
  const capsule = MeshBuilder.CreateCapsule(`player-${e}`, { radius: PLAYER.radius, height: PLAYER.height }, scene);
  capsule.position.set(at.x, at.y + PLAYER.height / 2, at.z);
  capsule.isVisible = false;
  const aggregate = new PhysicsAggregate(capsule, PhysicsShapeType.CAPSULE, { mass: 1, friction: 0, restitution: 0 }, scene);
  aggregate.body.setMassProperties({ inertia: Vector3.Zero() }); // never tip over
  aggregate.shape.filterMembershipMask = Layer.Player;
  aggregate.shape.filterCollideMask = Layer.Ground | Layer.Wall | Layer.Enemy;
  world.add(e, Body, { aggregate, mesh: capsule });

  // 2D sprite: a Y-billboarded quad, child of the capsule so it follows the body.
  const root = new TransformNode(`sprite-root-${e}`, scene);
  root.parent = capsule;
  root.position.y = -PLAYER.height / 2; // pivot at the feet, for squash/stretch
  const plane = MeshBuilder.CreatePlane(`sprite-${e}`, { width: 1.8, height: 1.8 }, scene);
  plane.parent = root;
  plane.position.y = 0.9;
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.material = materials.player.idle;

  const shadow = MeshBuilder.CreateGround(`shadow-${e}`, { width: 1.1, height: 0.7 }, scene);
  shadow.material = materials.shadow;
  shadow.isPickable = false;

  // Sword trail: a flat crescent in front of the player (local +z), shown during the swing.
  const arc = (70 * Math.PI) / 180;
  const inner: Vector3[] = [], outer: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24 * 2 - 1; // -1..1 along the arc
    const a = u * arc;
    const thick = Math.cos(u * Math.PI / 2); // pointed tips
    const ro = 2.1, ri = ro - 0.15 - 0.85 * thick;
    inner.push(new Vector3(Math.sin(a) * ri, 0, Math.cos(a) * ri));
    outer.push(new Vector3(Math.sin(a) * ro, 0, Math.cos(a) * ro));
  }
  const slash = MeshBuilder.CreateRibbon(`slash-${e}`, { pathArray: [inner, outer], sideOrientation: Mesh.DOUBLESIDE }, scene);
  slash.material = materials.slashFx;
  slash.isPickable = false;
  slash.setEnabled(false);

  world.add(e, PlayerSprite, {
    root, plane, shadow, slash, frames: materials.player, facing: 1, walkPhase: 0, stretch: 1,
  });
  world.add(e, PlayerInput, { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false });
  world.add(e, Player, {
    grounded: false, airTime: 0, jumpBuffer: 0, jumpHeld: false,
    attackHeld: false, dodgeHeld: false, attackBuffer: 0, dodgeBuffer: 0,
    action: "none", actionTime: 0, actionDir: { x: 0, z: 1 }, combo: 0,
  });
  world.add(e, Health, { hp: vitals.hp, max: PLAYER.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Stamina, { value: vitals.stamina, max: stats.stamina, regenDelay: 0 });
  world.add(e, FighterStats, { ...stats });
  world.add(e, Fighter, { team: "player", radius: PLAYER.radius });
  if (local) world.add(e, LocalPlayer, true);
  return e;
}
