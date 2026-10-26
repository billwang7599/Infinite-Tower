/** Assembles the arena player from components: Havok capsule, billboard sprite, blob shadow, slash trail. */
import { Mesh, MeshBuilder, PhysicsShapeType, Vector3 } from "@babylonjs/core";
import {
  Fighter, FighterStats, Health, LocalPlayer, Player, PLAYER, PlayerInput, Stamina,
  type Burden, type Entity, type Stats, type Vec3, type Vitals,
} from "@infinite-tower/shared";
import { addBody, Layer } from "../components.js";
import type { BattleContext } from "../context.js";
import { PlayerSprite, SPRITE_SIZE, spriteY } from "./components.js";

/** The local player, feet at `at`, weighed down by `burden` (from the bag). */
export function spawnPlayer(ctx: BattleContext, at: Vec3, vitals: Vitals, stats: Stats, burden: Burden): Entity {
  const { world, scene, materials } = ctx;
  const e = world.spawn();

  // Physics capsule (invisible). Havok owns its transform.
  const capsule = MeshBuilder.CreateCapsule(`player-${e}`, { radius: PLAYER.radius, height: PLAYER.height }, scene);
  capsule.position.set(at.x, at.y + PLAYER.height / 2, at.z);
  capsule.isVisible = false;
  addBody(world, e, capsule, PhysicsShapeType.CAPSULE, {
    mass: 1, friction: 0, layer: Layer.Player, collidesWith: Layer.Ground | Layer.Wall | Layer.Enemy,
    massProperties: { inertia: Vector3.Zero() },
  });

  // 2D sprite: a Y-billboarded quad, child of the capsule so it follows the body. sprite.ts keeps its bottom
  // edge on the feet as it squashes and stretches.
  const plane = MeshBuilder.CreatePlane(`sprite-${e}`, { width: SPRITE_SIZE, height: SPRITE_SIZE }, scene);
  plane.parent = capsule;
  plane.position.y = spriteY(1, 0);
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.material = materials.player.idle;

  const shadow = MeshBuilder.CreateGround(`shadow-${e}`, { width: 1.1, height: 0.7 }, scene);
  shadow.material = materials.blobShadow;
  shadow.isPickable = false;

  // Sword trail: a flat crescent in front of the player (local +z), shown during the swing. It spans the same
  // arc the slash hits, so what you see is what hits.
  const halfArc = Math.acos(PLAYER.slash.minDot);
  const inner: Vector3[] = [], outer: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24 * 2 - 1; // -1..1 along the arc
    const a = u * halfArc;
    const thick = Math.cos(u * Math.PI / 2); // pointed tips
    const ro = 2.1, ri = ro - 0.15 - 0.85 * thick;
    inner.push(new Vector3(Math.sin(a) * ri, 0, Math.cos(a) * ri));
    outer.push(new Vector3(Math.sin(a) * ro, 0, Math.cos(a) * ro));
  }
  const slash = MeshBuilder.CreateRibbon(
    `slash-${e}`, { pathArray: [inner, outer], sideOrientation: Mesh.DOUBLESIDE }, scene,
  );
  slash.material = materials.slashFx;
  slash.isPickable = false;
  slash.setEnabled(false);

  world.add(e, PlayerSprite, { plane, shadow, slash, facing: 1, walkPhase: 0, stretch: 1 });
  world.add(e, PlayerInput, { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false });
  world.add(e, Player, {
    grounded: false, airTime: 0, jumpBuffer: 0, jumpHeld: false,
    attackHeld: false, dodgeHeld: false, attackBuffer: 0, dodgeBuffer: 0,
    action: "none", actionTime: 0, actionDir: { x: 0, z: 1 }, combo: 0, burden,
  });
  world.add(e, Health, { hp: vitals.hp, max: PLAYER.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Stamina, { value: vitals.stamina, max: stats.stamina, regenDelay: 0 });
  world.add(e, FighterStats, { ...stats });
  world.add(e, Fighter, { team: "player", radius: PLAYER.radius });
  world.add(e, LocalPlayer, true);
  return e;
}
