import { Color3, DynamicTexture, StandardMaterial, VertexBuffer, type Mesh } from "@babylonjs/core";
import { dampFactor, distXZ, type Entity, type Look, type Vec2, type World } from "@infinite-tower/shared";
import { CHIBI_FACINGS, type ChibiFacing } from "../../gfx/look/look.js";
import {
  Npc, OverworldActor, OverworldPos, Peer, Speech, type OverworldActorData,
} from "../../modes/overworld/components.js";
import { facingOnScreen, mirrorFor, type Facing } from "../../modes/overworld/facing.js";
import { chibiDraw } from "../characters.js";
import { byEnemy } from "../enemies/index.js";
import { NPC_LOOKS } from "../npcs/index.js";
import type { Blobs } from "../sky/blobs.js";
import { spriteMaterial } from "../sprites.js";
import type { Visual } from "../visuals.js";
import { speechBubble, type Bubble } from "./bubble.js";
import { standingQuad, type OverworldScene } from "./scene.js";

/** Server snapshots arrive ~20x/s: glide toward them (1/s, for dampFactor); snap if far off (respawn, teleport). */
const GLIDE_RATE = 14;
const SNAP_DIST_TILES = 3;
/** Slower than this (tiles/s) counts as standing: no walk hop. */
const MOVING_SPEED = 0.1;
const WALK_CYCLE_RAD_PER_SEC = 12;
const HOP_TILES = 0.12;

/** The feet sit this share of a sprite's height above its bottom edge. */
const FOOT_SHARE = 0.1;
const BLOB_LENGTH_SHARE = 0.6;
const BLOB_WIDTH_SHARE = 0.4;
const PLAYER_SIZE_TILES = 1.6;
const PILE_SIZE_TILES = 1.4;
const BEDROLL_SIZE_TILES = 1.4;
const NAME_WIDTH_TILES = 2.4;
const NAME_HEIGHT_TILES = 0.4;
const NAME_TEXTURE_PX = { width: 384, height: 64 };
const MARKER_TILES = 0.8;
export const QUARTER_TURN_RAD = Math.PI / 2;

/** The chibi's picture for each way it walks: the front faces the camera, "down" the screen. */
const CHIBI_FACING = {
  down: "front", up: "back", left: "side", right: "side",
} as const satisfies Record<Facing, ChibiFacing>;

interface Named {
  name: Mesh;
  fighting: Mesh;
  owned: StandardMaterial[];
}

interface Walker {
  view: OverworldScene;
  mesh: Mesh;
  blobs: Blobs;
  tint: Float32Array;
  facings: Record<ChibiFacing, StandardMaterial> | null;
  alert: Mesh | null;
  named: Named | null;
  bubble: Bubble | null;
  sizeTiles: number;
  drawn: Vec2;
  glide: boolean;
  walkPhase: number;
  /** Side-only pictures keep their last side while walking toward or away from the camera. */
  mirror: 1 | -1;
}

function walker(spec: {
  material: (view: OverworldScene) => StandardMaterial;
  facings?: (view: OverworldScene) => Record<ChibiFacing, StandardMaterial>;
  sizeTiles: number;
  glide: boolean;
  alert?: boolean;
}): Visual<Walker, OverworldScene> {
  return {
    spawn(view, world, e) {
      const pos = world.require(e, OverworldPos), { scene, materials } = view, size = spec.sizeTiles;
      const mesh = standingQuad(scene, "overworld-actor", size, size, FOOT_SHARE);
      const tint = new Float32Array(16).fill(1);
      mesh.setVerticesData(VertexBuffer.ColorKind, tint, true);
      const blobs = view.sky.blobs(materials.blob, size * BLOB_LENGTH_SHARE, size * BLOB_WIDTH_SHARE);
      let alert: Mesh | null = null;
      if (spec.alert) {
        alert = standingQuad(scene, "overworld-alert", 0.9, 0.9);
        alert.material = materials.alert;
        alert.setEnabled(false);
      }
      const npc = world.get(e, Npc);
      const shown = world.get(e, Peer)?.character ?? (npc ? NPC_LOOKS[npc.id] : null);
      const named = shown ? namedExtras(view, shown.name) : null;
      const facings = shown ? lookFacings(view, shown.look, named!) : spec.facings?.(view) ?? null;
      mesh.material = facings?.front ?? spec.material(view);
      return {
        view, mesh, blobs, tint, alert, named, bubble: null, mirror: 1, facings, sizeTiles: size,
        drawn: { x: pos.x, z: pos.z }, glide: spec.glide, walkPhase: 0,
      };
    },
    frame: drawWalker,
    dispose(w) {
      w.mesh.dispose();
      w.blobs.dispose();
      w.alert?.dispose();
      w.bubble?.dispose();
      if (!w.named) return;
      w.named.name.dispose();
      w.named.fighting.dispose();
      for (const m of w.named.owned) m.dispose(false, true);
    },
  };
}

export const WALKERS: Record<OverworldActorData["kind"], Visual<Walker, OverworldScene>> = {
  player: walker({
    material: (v) => v.materials.player.front, facings: (v) => v.materials.player, sizeTiles: PLAYER_SIZE_TILES,
    glide: false,
  }),
  peer: walker({ material: (v) => v.materials.player.front, sizeTiles: PLAYER_SIZE_TILES, glide: true }),
  npc: walker({ material: (v) => v.materials.player.front, sizeTiles: PLAYER_SIZE_TILES, glide: false }),
  pile: walker({ material: (v) => v.materials.pile, sizeTiles: PILE_SIZE_TILES, glide: false }),
  trace: walker({ material: (v) => v.materials.bedroll, sizeTiles: BEDROLL_SIZE_TILES, glide: false }),
  ...byEnemy(({ sprite }, id) => walker({
    material: (v) => v.materials.enemies[id], sizeTiles: sprite.sizeTiles, glide: true, alert: true,
  })),
};

function lookFacings(view: OverworldScene, look: Look, named: Named): Record<ChibiFacing, StandardMaterial> {
  const facings = Object.fromEntries(CHIBI_FACINGS.map((facing) =>
    [facing, spriteMaterial(view.scene, `overworld-look-${facing}`, chibiDraw(look, facing))])) as
    Record<ChibiFacing, StandardMaterial>;
  named.owned.push(...Object.values(facings));
  return facings;
}

function namedExtras(view: OverworldScene, name: string): Named {
  const { scene } = view;
  const texture = new DynamicTexture("overworld-name", NAME_TEXTURE_PX, scene, true);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.font = `600 40px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(10, 8, 14, 0.85)";
  ctx.fillStyle = "#f2ead8";
  const { width, height } = NAME_TEXTURE_PX;
  ctx.strokeText(name, width / 2, height / 2, width - 16);
  ctx.fillText(name, width / 2, height / 2, width - 16);
  texture.hasAlpha = true;
  texture.update();
  const material = new StandardMaterial("overworld-name", scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true;
  material.emissiveColor = Color3.White();
  material.backFaceCulling = false;
  const nameMesh = standingQuad(scene, "overworld-name", NAME_WIDTH_TILES, NAME_HEIGHT_TILES);
  nameMesh.material = material;
  const fighting = standingQuad(scene, "overworld-fighting", MARKER_TILES, MARKER_TILES);
  fighting.material = view.materials.fighting;
  fighting.setEnabled(false);
  return { name: nameMesh, fighting, owned: [material] };
}

function glideWalker(
  w: Walker, world: World, e: Entity, dt: number,
): { actor: OverworldActorData; hop: number } {
  const pos = world.require(e, OverworldPos), actor = world.require(e, OverworldActor), at = w.drawn;
  const k = !w.glide || distXZ(at, pos) > SNAP_DIST_TILES ? 1 : dampFactor(GLIDE_RATE, dt);
  at.x += (pos.x - at.x) * k;
  at.z += (pos.z - at.z) * k;
  const moving = Math.hypot(actor.vx, actor.vz) > MOVING_SPEED;
  w.walkPhase = moving ? w.walkPhase + dt * WALK_CYCLE_RAD_PER_SEC : 0;
  return { actor, hop: Math.abs(Math.sin(w.walkPhase)) * HOP_TILES };
}

const tint = new Color3();

function drawWalker(w: Walker, world: World, e: Entity, dt: number): void {
  const { actor, hop } = glideWalker(w, world, e, dt), at = w.drawn, yaw = w.view.yawRad, { sky } = w.view;
  const facing = facingOnScreen(actor.heading, Math.round(yaw / QUARTER_TURN_RAD));
  if (w.facings || facing === "left" || facing === "right") w.mirror = mirrorFor(facing);
  w.mesh.position.set(at.x, hop, at.z);
  w.mesh.rotation.y = yaw;
  w.mesh.scaling.x = w.mirror;
  sky.tintAt({ x: at.x, y: w.sizeTiles / 2, z: at.z }, tint);
  for (let i = 0; i < w.tint.length; i += 4) w.tint.set([tint.r, tint.g, tint.b], i);
  w.mesh.updateVerticesData(VertexBuffer.ColorKind, w.tint);
  w.blobs.place({ x: at.x, y: 0, z: at.z }, w.sizeTiles / 2);
  if (w.facings) {
    const material = w.facings[CHIBI_FACING[facing]];
    if (w.mesh.material !== material) w.mesh.material = material;
  }
  if (w.alert) {
    w.alert.setEnabled(actor.alert);
    const side = 0.2 * w.mirror;
    w.alert.rotation.y = yaw;
    if (actor.alert) w.alert.position.set(at.x + side * Math.cos(yaw), w.sizeTiles * 0.9, at.z - side * Math.sin(yaw));
  }
  let overHeadY = w.sizeTiles * 0.95;
  if (w.named) {
    const fighting = world.get(e, Peer)?.fighting ?? false;
    w.named.name.position.set(at.x, overHeadY, at.z);
    w.named.name.rotation.y = yaw;
    w.named.fighting.setEnabled(fighting);
    w.named.fighting.position.set(at.x, overHeadY + NAME_HEIGHT_TILES, at.z);
    w.named.fighting.rotation.y = yaw;
    overHeadY += NAME_HEIGHT_TILES + (fighting ? MARKER_TILES : 0);
  }
  const said = world.get(e, Speech)?.text ?? null;
  if (said !== (w.bubble?.text ?? null)) {
    w.bubble?.dispose();
    w.bubble = said === null ? null : speechBubble(w.view.scene, said);
  }
  w.bubble?.mesh.position.set(at.x, overHeadY, at.z);
  if (w.bubble) w.bubble.mesh.rotation.y = yaw;
}
