/** The arena player's drawing, on the fight's player entity: billboard sprite, blob shadow, slash trail. */
import { Mesh, MeshBuilder, TransformNode, Vector3 } from "@babylonjs/core";
import { Body, PLAYER, type Entity, type World } from "@infinite-tower/shared";
import { BodyNode } from "../components.js";
import type { BattleContext } from "../context.js";
import { PlayerSprite, SPRITE_SIZE, spriteY } from "./components.js";

/** Draws the fight's player `e` (in the fight's `world`). */
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
  plane.material = materials.player.stand;

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

  world.add(e, PlayerSprite, { plane, shadow, slash, walkPhase: 0, stretch: 1 });
}
