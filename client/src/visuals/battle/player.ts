import { Color3, Material, Mesh, MeshBuilder, StandardMaterial, TransformNode } from "@babylonjs/core";
import {
  Body, clamp, damp, Enemy, Health, Player, PLAYER, SkillObject, Skilled, weaponItemIn, WEAPONS, Wielder, type Entity,
  type PlayerData, type Vec2, type World,
} from "@infinite-tower/shared";
import { blocking } from "@infinite-tower/shared/fight";
import { VIEWS, type BattleFacing } from "../../gfx/look/art.js";
import type { Blobs } from "../sky/blobs.js";
import { fighter } from "./battle.js";
import { bladeEdge, dropBlade, holdBlade, placeBlade, showCue, type HeldBlade } from "./blade.js";
import { facingSeen, playerBlade, SPRITE_SIZE, spritePose, STAGGERED } from "./pose.js";
import type { ArenaScene } from "./scene.js";
import { dropPerson, framePerson, newPerson, type PersonDrawing } from "./person/animation.js";
import { lookOf } from "./skillLooks.js";
import { buildSlash, placeSlash, type Slash } from "./slash.js";
import { MOTIONS, WEAPON_LOOKS } from "./weapons.js";

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
  slash: Slash;
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
  person: PersonDrawing | null;
}

interface Stance extends Pick<PlayerData, "action" | "actionTime" | "actionDir" | "way" | "grounded"> {
  leaving: boolean;
  aim: Vec2;
}
type StanceOf = (world: World, e: Entity) => Stance;

const playerStance: StanceOf = (world, e) => {
  const { action, actionTime, actionDir, way, grounded, leftArena } = world.require(e, Player);
  return { action, actionTime, actionDir, way, grounded, leaving: leftArena, aim: world.require(e, Skilled).aim };
};

const ENEMY_STAGGERS = ["staggered", "stunned"];

const enemyStance: StanceOf = (world, e) => {
  const { state, stateTime, yaw } = world.require(e, Enemy), facing = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const action = ENEMY_STAGGERS.includes(state) ? "stagger" : blocking(world, e) ? "block" : "none";
  return { action, actionTime: stateTime, actionDir: world.require(e, Wielder).swing?.dir ?? facing, way: null,
    grounded: true, leaving: false, aim: facing };
};

const personVisual = (kind: "player" | "enemy", stanceOf: StanceOf) => fighter<PlayerSprite>(kind, {
  spawn, dispose, frame: (sprite, world, e, dt) => frame(sprite, world, e, dt, stanceOf(world, e)),
});

export const playerVisual = personVisual("player", playerStance);
export const personEnemyVisual = personVisual("enemy", enemyStance);

function spawn(ctx: ArenaScene, _world: World, e: Entity, node: TransformNode): PlayerSprite {
  const { scene, materials } = ctx;

  const plane = MeshBuilder.CreatePlane(`sprite-${e}`, { width: SPRITE_SIZE, height: SPRITE_SIZE }, scene);
  plane.parent = node;
  plane.position.y = spriteY(1, 0);
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.material = materials.player.back.stand[0]!;
  plane.setEnabled(!ctx.pixel.player3d);

  const shadows = ctx.sky.blobs(materials.blobShadow, SHADOW_LENGTH_M, 0.7);

  return {
    ctx, node, plane, shadows, slash: buildSlash(scene, `${e}`, materials.slashFx), walkPhase: 0, stretch: 1,
    staggerTime: 0, fading: null, facing: "back",
    sword: materials.slashFx, blade: null, person: ctx.pixel.player3d ? newPerson() : null,
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
  sprite.slash.mesh.dispose();
  dropBlade(sprite.blade);
  if (sprite.person) dropPerson(sprite.person);
}

function frame(sprite: PlayerSprite, world: World, e: Entity, dt: number, player: Stance): void {
  const { ctx } = sprite, health = world.require(e, Health), { swing, hands } = world.require(e, Wielder);
  const weapon = weaponItemIn(hands), motion = weapon && MOTIONS[WEAPONS[weapon].kind];
  sprite.staggerTime = STAGGERED.includes(player.action) ? Math.max(sprite.staggerTime, health.hitstun) : 0;
  const stagger = { left: health.hitstun, of: sprite.staggerTime };
  if (sprite.person) framePerson(sprite.person, ctx, sprite.node, world, e, dt, player, stagger);
  else drawSprite(sprite, world, e, dt, player, stagger);

  const blade = sprite.person?.blade ?? sprite.blade;
  const edge = blade?.root.isEnabled() ? bladeEdge(blade.hand, WEAPON_LOOKS[blade.weapon]) : null;
  placeSlash(sprite.slash, motion?.trail(swing) ?? null, edge, dt);

  let imbued = null;
  for (const [, o] of world.query(SkillObject)) {
    if (o.kind === "imbue" && o.caster === e) imbued = lookOf(o.skill.segments[o.segment]!.elements);
  }
  const sword = ctx.skills.slashFor(imbued);
  if (sword !== sprite.sword) {
    sprite.sword = sword;
    sprite.slash.mesh.material = sword;
  }
}

function drawSprite(
  sprite: PlayerSprite, world: World, e: Entity, dt: number, player: Stance, stagger: { left: number; of: number },
): void {
  const { ctx } = sprite;
  const body = world.require(e, Body), health = world.require(e, Health);
  const wielder = world.require(e, Wielder), { swing, hands } = wielder, weapon = weaponItemIn(hands);
  const motion = weapon && MOTIONS[WEAPONS[weapon].kind];
  const p = sprite.node.position, vel = body.vel;
  const alive = health.hp > health.floor;

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
  const pose = spritePose(player, wielder, alive, sprite.stretch, stagger);
  const { aim } = player;
  sprite.facing = facingSeen(ctx.battle.view.eye, p, aim, sprite.facing);
  const look = ctx.looks.get(e);
  const picture = look?.battleSprite(sprite.facing, pose.pose, pose.frame)
    ?? ctx.materials.player.back[pose.pose][pose.frame]!;
  ctx.sky.tintAt(p, picture.emissiveColor);
  const shown = player.leaving ? fadingCopy(sprite, picture) : picture;
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
    }, faceYaw, playerBlade(player, wielder, alive, motion), dt);
  }
  if (sprite.blade) showCue(sprite.blade.cue, alive ? swing : null);


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
}
