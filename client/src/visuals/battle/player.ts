import { Mesh, MeshBuilder, TransformNode, Vector3, type StandardMaterial } from "@babylonjs/core";
import {
  Body, clamp, damp, Health, Player, PLAYER, SpellObject, weaponIn, Wielder, type Entity, type World,
} from "@infinite-tower/shared";
import { fighter } from "./battle.js";
import { spritePose } from "./pose.js";
import type { ArenaScene } from "./scene.js";
import { lookOf } from "./spellLooks.js";
import { drawChantCircle, dropChantCircle, type ChantCircle } from "./spells.js";
import { thrustPose, trailPose } from "./weapons.js";

const SPRITE_SIZE = 1.8;
/** The sword trail's length (m), end to end. */
const TRAIL_WIDTH = 2.2;
/** The blob shadow looks this far down for the floor. */
const SHADOW_REACH = 30;

/** Where the sprite's center sits above the body's, so its bottom edge stays on the feet. */
const spriteY = (stretch: number, bob: number): number => -PLAYER.height / 2 + (SPRITE_SIZE / 2) * stretch + bob;

interface PlayerSprite {
  ctx: ArenaScene;
  node: TransformNode;
  plane: Mesh;
  shadow: Mesh;
  /** Turned to the aim and the swing's line; the crescent under it sweeps along that line. */
  trail: TransformNode;
  slash: Mesh;
  /** Turned to the aim: the stab's streak, and the block's guard. */
  thrust: TransformNode;
  guard: TransformNode;
  /** Accumulated walk-cycle phase, for bobbing. */
  walkPhase: number;
  /** Smoothed squash/stretch factor. */
  stretch: number;
  /** The hitstun the current stagger began with (0: not staggered). */
  staggerTime: number;
  sword: StandardMaterial;
  chant: ChantCircle | null;
}

export const playerVisual = fighter<PlayerSprite>("player", { spawn, frame, dispose });

function spawn(ctx: ArenaScene, _world: World, e: Entity, node: TransformNode): PlayerSprite {
  const { scene, materials } = ctx;

  const plane = MeshBuilder.CreatePlane(`sprite-${e}`, { width: SPRITE_SIZE, height: SPRITE_SIZE }, scene);
  plane.parent = node;
  plane.position.y = spriteY(1, 0);
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.material = materials.player.stand[0]!;

  const shadow = MeshBuilder.CreateGround(`shadow-${e}`, { width: 1.1, height: 0.7 }, scene);
  shadow.material = materials.blobShadow;
  shadow.isPickable = false;

  // Sword trail: a cut across the view in front of the player, a shallow arc from x = 0 to TRAIL_WIDTH (pointed at
  // both ends), turned to the swing's line and grown from its start. Drawn over the sprite.
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

  const thrust = new TransformNode(`thrust-${e}`, scene);
  const streak = MeshBuilder.CreateCylinder(
    `streak-${e}`, { height: 1, diameterTop: 0.02, diameterBottom: 0.12, tessellation: 8 }, scene,
  );
  streak.parent = thrust;
  streak.rotation.x = Math.PI / 2;
  streak.position.z = 0.5;
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

  return {
    ctx, node, plane, shadow, trail, slash, thrust, guard, walkPhase: 0, stretch: 1, staggerTime: 0,
    sword: materials.slashFx, chant: null,
  };
}

// The plane goes with the body's node; the shadow and sword effects aren't under it.
function dispose(sprite: PlayerSprite): void {
  sprite.shadow.dispose();
  for (const node of [sprite.trail, sprite.thrust, sprite.guard]) node.dispose();
  dropChantCircle(sprite.ctx.spells, sprite.chant);
}

function frame(sprite: PlayerSprite, world: World, e: Entity, dt: number): void {
  const { ctx } = sprite;
  const body = world.require(e, Body), player = world.require(e, Player), health = world.require(e, Health);
  const { swing, hands } = world.require(e, Wielder), weapon = weaponIn(hands);
  const p = sprite.node.position, vel = body.vel;
  const alive = health.hp > 0;

  const speed = Math.hypot(vel.x, vel.z);
  const walking = alive && player.grounded && speed > 0.5 && player.action === "none";
  sprite.walkPhase = walking ? sprite.walkPhase + dt * speed * 2.4 : 0;
  const bob = Math.abs(Math.sin(sprite.walkPhase)) * 0.08;

  const targetStretch = !alive ? 1
    : player.action === "dodge" ? 0.72
    : !player.grounded ? 1 + clamp(Math.abs(vel.y) * 0.015, -0.12, 0.15)
    : 1;
  sprite.stretch = damp(sprite.stretch, targetStretch, 18, dt);
  sprite.staggerTime = player.action === "stagger" ? Math.max(sprite.staggerTime, health.hitstun) : 0;
  const pose = spritePose(player, swing, alive, sprite.stretch, { left: health.hitstun, of: sprite.staggerTime });
  const picture = ctx.materials.player[pose.pose][pose.frame]!;
  if (sprite.plane.material !== picture) sprite.plane.material = picture;
  sprite.plane.scaling.set(pose.scaleX, pose.scaleY, 1);
  sprite.plane.position.y = spriteY(sprite.stretch, bob);
  sprite.plane.position.x = pose.pose === "stagger" ? Math.sin(health.hitstun * 45) * 0.06 : 0;

  sprite.plane.isVisible = !(alive && health.invuln > 0 && Math.floor(health.invuln * 16) % 2 === 1);

  const aimYaw = Math.atan2(player.actionDir.x, player.actionDir.z);
  const trail = trailPose(swing);
  sprite.trail.setEnabled(trail !== null);
  if (trail) {
    // A metre ahead at the sprite's chest, across the view; the cut grows from its start end.
    sprite.trail.position.set(p.x + player.actionDir.x, p.y + 0.35, p.z + player.actionDir.z);
    sprite.trail.rotation.set(0, aimYaw, trail.rollRad);
    sprite.slash.position.x = trail.from * TRAIL_WIDTH / 2;
    sprite.slash.scaling.x = -trail.from * trail.reach;
    sprite.slash.visibility = trail.visibility;
  }
  const thrust = weapon && thrustPose(swing, weapon);
  sprite.thrust.setEnabled(thrust !== null);
  if (thrust) {
    sprite.thrust.position.set(p.x, p.y + 0.25, p.z);
    sprite.thrust.rotation.y = aimYaw;
    sprite.thrust.scaling.set(1, 1, thrust.reachM);
    for (const mesh of sprite.thrust.getChildMeshes()) mesh.visibility = thrust.visibility;
  }
  sprite.guard.setEnabled(alive && player.action === "block");
  sprite.guard.position.set(p.x, p.y, p.z);
  sprite.guard.rotation.y = aimYaw;

  const below = ctx.battle.fight?.physics.floorBelow(p.x, p.y, p.z, SHADOW_REACH) ?? null;
  if (below !== null) {
    const floorY = p.y - below;
    const height = p.y - body.centerHeight - floorY;
    const scale = Math.max(0.3, 1 - height * 0.12);
    sprite.shadow.isVisible = true;
    sprite.shadow.position.set(p.x, floorY + 0.02, p.z);
    sprite.shadow.scaling.set(scale, 1, scale);
  } else {
    sprite.shadow.isVisible = false;
  }

  let imbued = null;
  for (const [, o] of world.query(SpellObject)) {
    if (o.kind === "imbue" && o.caster === e) imbued = lookOf(o.spell.segments[o.segment]!.elements);
  }
  const sword = ctx.spells.slashFor(imbued);
  if (sword !== sprite.sword) {
    sprite.sword = sword;
    sprite.slash.material = sword;
    for (const mesh of sprite.thrust.getChildMeshes()) mesh.material = sword;
  }
  sprite.chant = drawChantCircle(ctx.spells, sprite.chant, player, body, sprite.node);
}
