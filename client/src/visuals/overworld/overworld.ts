import { MeshBuilder, Vector3, type Mesh, type StandardMaterial } from "@babylonjs/core";
import {
  dampFactor, distXZ, type Entity, type LevelLayout, type Vec2, type World,
} from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import { OverworldActor, OverworldPos, type OverworldActorData } from "../../modes/overworld/components.js";
import { mirrorFor, type Facing } from "../../modes/overworld/facing.js";
import { byEnemy } from "../enemies/index.js";
import type { Visual } from "../visuals.js";
import { standingQuad, type OverworldScene } from "./scene.js";
import { buildLevel, type LevelDrawing } from "./terrain.js";

/** Server snapshots arrive ~20x/s: glide toward them (1/s, for dampFactor); snap if far off (respawn, teleport). */
const GLIDE_RATE = 14;
const SNAP_DIST_TILES = 3;
/** Slower than this (tiles/s) counts as standing: no walk hop. */
const MOVING_SPEED = 0.1;
const WALK_CYCLE_RAD_PER_SEC = 12;
const HOP_TILES = 0.12;

/** The feet sit this share of a sprite's height above its bottom edge. */
const FOOT_SHARE = 0.1;
const CAMERA_FOLLOW_RATE = 10;
const CAMERA_DISTANCE = 21;
const CAMERA_PITCH_RAD = (50 * Math.PI) / 180;

/** The chibi's picture for each way it walks: the front faces the camera, "down" the screen. */
const CHIBI_FACING = {
  down: "front", up: "back", left: "side", right: "side",
} as const satisfies Record<Facing, ChibiFacing>;

interface Walker {
  mesh: Mesh;
  blob: Mesh;
  facings: Record<ChibiFacing, StandardMaterial> | null;
  alert: Mesh | null;
  sizeTiles: number;
  drawn: Vec2;
  glide: boolean;
  walkPhase: number;
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
      const pos = world.require(e, OverworldPos), { scene, materials, sunShadows } = view, size = spec.sizeTiles;
      const mesh = standingQuad(scene, "overworld-actor", size, size, FOOT_SHARE);
      mesh.material = spec.material(view);
      sunShadows.addShadowCaster(mesh);
      const blob = MeshBuilder.CreateGround("overworld-blob", { width: size * 0.7, height: size * 0.35 }, scene);
      blob.material = materials.blob;
      let alert: Mesh | null = null;
      if (spec.alert) {
        alert = standingQuad(scene, "overworld-alert", 0.9, 0.9);
        alert.material = materials.alert;
        alert.setEnabled(false);
      }
      return {
        mesh, blob, alert, facings: spec.facings?.(view) ?? null, sizeTiles: size, drawn: { x: pos.x, z: pos.z },
        glide: spec.glide, walkPhase: 0,
      };
    },
    frame: drawWalker,
    dispose(w) {
      w.mesh.dispose();
      w.blob.dispose();
      w.alert?.dispose();
    },
  };
}

export const WALKERS: Record<OverworldActorData["kind"], Visual<Walker, OverworldScene>> = {
  player: walker({ material: (v) => v.materials.player.front, facings: (v) => v.materials.player, sizeTiles: 1.6, glide: false }),
  ...byEnemy(({ sprite }, id) => walker({
    material: (v) => v.materials.enemies[id], sizeTiles: sprite.sizeTiles, glide: true, alert: true,
  })),
};

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

function drawWalker(w: Walker, world: World, e: Entity, dt: number): void {
  const { actor, hop } = glideWalker(w, world, e, dt), at = w.drawn;
  w.mesh.position.set(at.x, hop, at.z);
  w.mesh.scaling.x = mirrorFor(actor.facing);
  w.blob.position.set(at.x, 0.02, at.z);
  if (w.facings) {
    const material = w.facings[CHIBI_FACING[actor.facing]];
    if (w.mesh.material !== material) w.mesh.material = material;
  }
  if (w.alert) {
    w.alert.setEnabled(actor.alert);
    if (actor.alert) w.alert.position.set(at.x + 0.2 * mirrorFor(actor.facing), w.sizeTiles * 0.9, at.z);
  }
}

export function overworldStage(view: OverworldScene): (dt: number, fresh: boolean) => void {
  let level: { layout: LevelLayout; drawing: LevelDrawing } | null = null;
  const target = new Vector3();
  const back = new Vector3(0, Math.sin(CAMERA_PITCH_RAD), -Math.cos(CAMERA_PITCH_RAD)).scale(CAMERA_DISTANCE);
  return (dt, fresh) => {
    const { state, camera } = view;
    if (state.level !== level?.layout) {
      level?.drawing.root.dispose(false, true);
      level = state.level && { layout: state.level, drawing: buildLevel(view, state.level) };
      fresh = true;
    }
    if (!level) return;
    level.drawing.flicker(dt);
    const player = state.world.require(state.player, OverworldPos);
    const k = fresh ? 1 : dampFactor(CAMERA_FOLLOW_RATE, dt);
    target.x += (player.x - target.x) * k;
    target.z += (player.z - target.z) * k;
    camera.position.copyFrom(target).addInPlace(back);
    camera.setTarget(target);
  };
}
