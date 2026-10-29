import { MeshBuilder, Vector3, type Mesh, type StandardMaterial } from "@babylonjs/core";
import {
  dampFactor, distXZ, wrapAngle, type Entity, type LevelLayout, type Vec2, type World,
} from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import { OverworldActor, OverworldPos, type OverworldActorData } from "../../modes/overworld/components.js";
import { facingOnScreen, mirrorFor, type Facing } from "../../modes/overworld/facing.js";
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
const CAMERA_TURN_TIME = 0.25;
const QUARTER_TURN_RAD = Math.PI / 2;

/** The chibi's picture for each way it walks: the front faces the camera, "down" the screen. */
const CHIBI_FACING = {
  down: "front", up: "back", left: "side", right: "side",
} as const satisfies Record<Facing, ChibiFacing>;

interface Walker {
  view: OverworldScene;
  mesh: Mesh;
  blob: Mesh;
  facings: Record<ChibiFacing, StandardMaterial> | null;
  alert: Mesh | null;
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
        view, mesh, blob, alert, mirror: 1, facings: spec.facings?.(view) ?? null, sizeTiles: size, drawn: { x: pos.x, z: pos.z },
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
  const { actor, hop } = glideWalker(w, world, e, dt), at = w.drawn, yaw = w.view.yawRad;
  const facing = facingOnScreen(actor.heading, Math.round(yaw / QUARTER_TURN_RAD));
  if (w.facings || facing === "left" || facing === "right") w.mirror = mirrorFor(facing);
  w.mesh.position.set(at.x, hop, at.z);
  w.mesh.rotation.y = w.blob.rotation.y = yaw;
  w.mesh.scaling.x = w.mirror;
  w.blob.position.set(at.x, 0.02, at.z);
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
}

export function overworldStage(view: OverworldScene): (dt: number, fresh: boolean) => void {
  let level: { layout: LevelLayout; drawing: LevelDrawing } | null = null;
  const target = new Vector3(), back = new Vector3();
  const turn = { fromRad: 0, toRad: 0, time: CAMERA_TURN_TIME };
  let facedYaw = NaN;
  return (dt, fresh) => {
    const { state, camera } = view;
    if (state.level !== level?.layout) {
      level?.drawing.root.dispose(false, true);
      level = state.level && { layout: state.level, drawing: buildLevel(view, state.level) };
      facedYaw = NaN;
      fresh = true;
    }
    if (!level) return;
    level.drawing.flicker(dt);
    const wantedRad = state.cameraTurns * QUARTER_TURN_RAD;
    if (fresh) Object.assign(turn, { fromRad: wantedRad, toRad: wantedRad, time: CAMERA_TURN_TIME });
    else if (Math.abs(wrapAngle(wantedRad - turn.toRad)) > 1e-6) {
      Object.assign(turn, { fromRad: view.yawRad, toRad: view.yawRad + wrapAngle(wantedRad - view.yawRad), time: 0 });
    }
    turn.time = Math.min(turn.time + dt, CAMERA_TURN_TIME);
    const share = turn.time / CAMERA_TURN_TIME;
    view.yawRad = turn.fromRad + (turn.toRad - turn.fromRad) * share * share * (3 - 2 * share);
    if (view.yawRad !== facedYaw) level.drawing.face(facedYaw = view.yawRad);
    const flat = Math.cos(CAMERA_PITCH_RAD) * CAMERA_DISTANCE;
    back.set(-Math.sin(view.yawRad) * flat, Math.sin(CAMERA_PITCH_RAD) * CAMERA_DISTANCE, -Math.cos(view.yawRad) * flat);
    const player = state.world.require(state.player, OverworldPos);
    const k = fresh ? 1 : dampFactor(CAMERA_FOLLOW_RATE, dt);
    target.x += (player.x - target.x) * k;
    target.z += (player.z - target.z) * k;
    camera.position.copyFrom(target).addInPlace(back);
    camera.setTarget(target);
  };
}
