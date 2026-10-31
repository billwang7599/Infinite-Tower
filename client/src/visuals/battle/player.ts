import { Color3, Material, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import {
  Body, clamp, damp, Health, Player, PLAYER, Posture, SkillObject, Skilled, weaponItemIn, WEAPONS, Wielder,
  type Entity, type World,
} from "@infinite-tower/shared";
import { VIEWS, type BattleFacing } from "../../gfx/look/art.js";
import type { Blobs } from "../sky/blobs.js";
import { fighter } from "./battle.js";
import { dropBlade, holdBlade, placeBlade, type HeldBlade } from "./blade.js";
import { facingSeen, playerBlade, spritePose, STAGGERED } from "./pose.js";
import type { ArenaScene } from "./scene.js";
import { lookOf } from "./skillLooks.js";
import { MOTIONS } from "./weapons.js";

const SPRITE_SIZE = 1.8;
/** The sword trail's length (m), end to end. */
const TRAIL_WIDTH = 2.2;
/** The blob shadow looks this far down for the floor. */
const SHADOW_REACH = 30;
const SHADOW_LENGTH_M = 1.1;
const HEAVY_WINDUP_STRETCH = 0.9;

/** Where the sprite's center sits above the body's, so its bottom edge stays on the feet. */
const spriteY = (stretch: number, bob: number): number => -PLAYER.height / 2 + (SPRITE_SIZE / 2) * stretch + bob;

interface PlayerSprite {
  ctx: ArenaScene;
  node: TransformNode;
  plane: Mesh;
  shadows: Blobs;
  /** Turned to the aim and the swing's line; the crescent under it sweeps along that line. */
  trail: TransformNode;
  slash: Mesh;
  /** Accumulated walk-cycle phase, for bobbing. */
  walkPhase: number;
  /** Smoothed squash/stretch factor. */
  stretch: number;
  /** The hitstun the current stagger began with (0: not staggered). */
  staggerTime: number;
  /** The frames are alpha-tested, which ignores the mesh's visibility: leaving, the sprite fades in this blended copy. */
  fading: StandardMaterial | null;
  facing: BattleFacing;
  sword: StandardMaterial;
  blade: HeldBlade | null;
}

export const playerVisual = fighter<PlayerSprite>("player", { spawn, frame, dispose });

function spawn(ctx: ArenaScene, _world: World, e: Entity, node: TransformNode): PlayerSprite {
  const { scene, materials } = ctx;

  const plane = MeshBuilder.CreatePlane(`sprite-${e}`, { width: SPRITE_SIZE, height: SPRITE_SIZE }, scene);
  plane.parent = node;
  plane.position.y = spriteY(1, 0);
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.material = materials.player.back.stand[0]!;

  const shadows = ctx.sky.blobs(materials.blobShadow, SHADOW_LENGTH_M, 0.7);

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

  return {
    ctx, node, plane, shadows, trail, slash, walkPhase: 0, stretch: 1, staggerTime: 0, fading: null, facing: "back",
    sword: materials.slashFx, blade: null,
  };
}

function fadingCopy(sprite: PlayerSprite, picture: StandardMaterial): StandardMaterial {
  if (!sprite.fading) {
    const m = sprite.fading = new StandardMaterial(`${sprite.plane.name}-fading`, sprite.ctx.scene);
    m.disableLighting = true;
    m.specularColor = Color3.Black();
    m.backFaceCulling = false;
    m.useAlphaFromDiffuseTexture = true;
    m.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
  }
  sprite.fading.diffuseTexture = picture.diffuseTexture;
  sprite.fading.emissiveColor.copyFrom(picture.emissiveColor);
  return sprite.fading;
}

// The plane goes with the body's node; the shadow and sword effects aren't under it.
function dispose(sprite: PlayerSprite): void {
  sprite.shadows.dispose();
  sprite.fading?.dispose();
  sprite.trail.dispose();
  dropBlade(sprite.blade);
}

function frame(sprite: PlayerSprite, world: World, e: Entity, dt: number): void {
  const { ctx } = sprite;
  const body = world.require(e, Body), player = world.require(e, Player), health = world.require(e, Health);
  const wielder = world.require(e, Wielder), { swing, hands } = wielder, weapon = weaponItemIn(hands);
  const motion = weapon && MOTIONS[WEAPONS[weapon].kind];
  const p = sprite.node.position, vel = body.vel;
  const alive = health.hp > 0;

  const speed = Math.hypot(vel.x, vel.z);
  const walking = alive && player.grounded && speed > 0.5 && player.action === "none";
  sprite.walkPhase = walking ? sprite.walkPhase + dt * speed * 2.4 : 0;
  const bob = Math.abs(Math.sin(sprite.walkPhase)) * 0.08;

  const targetStretch = !alive ? 1
    : player.action === "dodge" ? 0.72
    : !player.grounded ? 1 + clamp(Math.abs(vel.y) * 0.015, -0.12, 0.15)
    : swing?.attack === "heavy" && swing.step < swing.liveAt ? HEAVY_WINDUP_STRETCH
    : 1;
  sprite.stretch = damp(sprite.stretch, targetStretch, 18, dt);
  sprite.staggerTime = STAGGERED.includes(player.action) ? Math.max(sprite.staggerTime, health.hitstun) : 0;
  const pose = spritePose(player, wielder, alive, sprite.stretch, { left: health.hitstun, of: sprite.staggerTime });
  const aim = world.require(e, Skilled).aim;
  sprite.facing = facingSeen(ctx.battle.view.eye, p, aim, sprite.facing);
  const look = ctx.looks.get(e);
  const picture = look?.battleSprite(sprite.facing, pose.pose, pose.frame)
    ?? ctx.materials.player.back[pose.pose][pose.frame]!;
  ctx.sky.tintAt(p, picture.emissiveColor);
  const shown = player.leftArena ? fadingCopy(sprite, picture) : picture;
  if (sprite.plane.material !== shown) sprite.plane.material = shown;
  sprite.plane.scaling.set(pose.scaleX, pose.scaleY, 1);
  sprite.plane.position.y = spriteY(sprite.stretch, bob);
  sprite.plane.position.x = pose.pose === "stagger" ? Math.sin(health.hitstun * 45) * 0.06 : 0;

  sprite.plane.isVisible = !(alive && health.invuln > 0 && Math.floor(health.invuln * 16) % 2 === 1);

  const facing = swing?.dir ?? aim, faceYaw = Math.atan2(facing.x, facing.z);
  if (weapon !== sprite.blade?.weapon) {
    dropBlade(sprite.blade);
    sprite.blade = weapon && holdBlade(ctx, e, sprite.node, weapon, faceYaw);
  }
  const hand = look?.handAt(sprite.facing, pose.pose, pose.frame) ?? null;
  sprite.blade?.root.setEnabled(hand !== null && sprite.plane.isVisible);
  if (sprite.blade && motion && hand) {
    const { position } = sprite.plane, across = hand[0] / VIEWS.battle.width - 0.5;
    const up = 0.5 - hand[1] / VIEWS.battle.height;
    placeBlade(sprite.blade, ctx.camera, {
      x: position.x + across * SPRITE_SIZE * pose.scaleX, y: position.y + up * SPRITE_SIZE * pose.scaleY,
    }, faceYaw, playerBlade(player, wielder, alive, motion, world.has(e, Posture)), dt);
  }

  const aimYaw = Math.atan2(player.actionDir.x, player.actionDir.z);
  const trail = motion?.trail(swing) ?? null;
  sprite.trail.setEnabled(trail !== null);
  if (trail) {
    // A metre ahead at the sprite's chest, across the view; the cut grows from its start end.
    sprite.trail.position.set(p.x + player.actionDir.x, p.y + 0.35, p.z + player.actionDir.z);
    sprite.trail.rotation.set(0, aimYaw, trail.rollRad);
    sprite.slash.position.x = trail.from * TRAIL_WIDTH / 2;
    sprite.slash.scaling.x = -trail.from * trail.reach;
    sprite.slash.visibility = trail.visibility;
  }

  const below = ctx.battle.fight?.physics.floorBelow(p.x, p.y, p.z, SHADOW_REACH) ?? null;
  if (below !== null) {
    const floorY = p.y - below;
    const height = p.y - body.centerHeight - floorY;
    // The sprite's visibility is 1 unless the fighter is fading out; the shadow fades with it.
    const scale = Math.max(0.3, 1 - height * 0.12);
    sprite.shadows.place({ x: p.x, y: floorY, z: p.z }, below, scale, sprite.plane.visibility);
  } else {
    sprite.shadows.place(null, 0);
  }

  let imbued = null;
  for (const [, o] of world.query(SkillObject)) {
    if (o.kind === "imbue" && o.caster === e) imbued = lookOf(o.skill.segments[o.segment]!.elements);
  }
  const sword = ctx.skills.slashFor(imbued);
  if (sword !== sprite.sword) {
    sprite.sword = sword;
    sprite.slash.material = sword;
  }
}
