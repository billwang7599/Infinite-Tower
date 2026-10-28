/** The arena player's drawing, on the fight's player: billboard sprite, blob shadow, the sword's effects. */
import { Mesh, MeshBuilder, TransformNode, Vector3 } from "@babylonjs/core";
import { attackShape, Body, STARTER_SWORD, type Entity, type World } from "@infinite-tower/shared";
import { BodyNode } from "../components.js";
import type { BattleContext } from "../context.js";
import { PlayerSprite, SPRITE_SIZE, spriteY } from "./components.js";

/** The sword trail's length (m), end to end. */
export const TRAIL_WIDTH = 2.2;

export function addPlayerSprite(ctx: BattleContext, world: World, e: Entity): void {
  const { scene, materials } = ctx;
  const node = new TransformNode(`player-${e}`, scene);
  const at = world.require(e, Body).pos;
  node.position.set(at.x, at.y, at.z);
  world.add(e, BodyNode, { node });

  // 2D sprite: a Y-billboarded quad under the body's node, so it follows the body. sprite.ts keeps its bottom
  // edge on the feet as it squashes and stretches.
  const plane = MeshBuilder.CreatePlane(`sprite-${e}`, { width: SPRITE_SIZE, height: SPRITE_SIZE }, scene);
  plane.parent = node;
  plane.position.y = spriteY(1, 0);
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.material = materials.player.stand[0]!;

  const shadow = MeshBuilder.CreateGround(`shadow-${e}`, { width: 1.1, height: 0.7 }, scene);
  shadow.material = materials.blobShadow;
  shadow.isPickable = false;

  // Sword trail: a cut across the view in front of the player, a shallow arc from x = 0 to TRAIL_WIDTH (pointed at
  // both ends), turned to the swing's line and grown from its start (sprite.ts). Drawn over the sprite.
  const inner: Vector3[] = [], outer: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, x = u * TRAIL_WIDTH, bulge = Math.sin(u * Math.PI);
    const y = bulge * 0.22, thick = 0.04 + 0.2 * bulge;
    inner.push(new Vector3(x, y - thick / 2, 0));
    outer.push(new Vector3(x, y + thick / 2, 0));
  }
  const trail = new TransformNode(`trail-${e}`, scene);
  const slash = MeshBuilder.CreateRibbon(
    `slash-${e}`, { pathArray: [inner, outer], sideOrientation: Mesh.DOUBLESIDE }, scene,
  );
  slash.parent = trail;
  slash.material = materials.slashFx;
  slash.isPickable = false;
  slash.renderingGroupId = 1;
  trail.setEnabled(false);

  // The stab: a thin streak out along the aim, as long as the stab reaches.
  const thrust = new TransformNode(`thrust-${e}`, scene);
  const reach = attackShape("stab", STARTER_SWORD).range;
  const streak = MeshBuilder.CreateCylinder(
    `streak-${e}`, { height: reach, diameterTop: 0.02, diameterBottom: 0.12, tessellation: 8 }, scene,
  );
  streak.parent = thrust;
  streak.rotation.x = Math.PI / 2;
  streak.position.z = reach / 2;
  streak.material = materials.slashFx;
  streak.isPickable = false;
  streak.renderingGroupId = 1;
  thrust.setEnabled(false);

  // The block: a pale disc held up in front, drawn over the sprite.
  const guard = new TransformNode(`guard-${e}`, scene);
  const disc = MeshBuilder.CreateDisc(`guard-disc-${e}`, { radius: 0.6, tessellation: 24 }, scene);
  disc.parent = guard;
  disc.position.set(0, 0.25, 0.6);
  disc.material = materials.guardFx;
  disc.isPickable = false;
  disc.renderingGroupId = 1;
  guard.setEnabled(false);

  world.add(e, PlayerSprite, { plane, shadow, trail, slash, thrust, guard, walkPhase: 0, stretch: 1, staggerTime: 0 });
}
