import { MeshBuilder, Vector3, type Mesh, type StandardMaterial } from "@babylonjs/core";
import {
  dampFactor, type Entity, type LevelLayout, type Vec2, type World,
} from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import { OverworldPos, type OverworldActorData } from "../../modes/overworld/components.js";
import { mirrorFor } from "../../modes/overworld/facing.js";
import { byEnemy } from "../enemies/index.js";
import { CHIBI_FACING, glideWalker } from "../overworld/overworld.js";
import type { Visual } from "../visuals.js";
import { standingQuad, type Overworld3dScene } from "./scene.js";
import { buildLevel3d, type Level3d } from "./terrain.js";

/** The feet sit this share of a sprite's height above its bottom edge. */
const FOOT_SHARE = 0.1;
const CAMERA_FOLLOW_RATE = 10;
const CAMERA_DISTANCE = 21;
const CAMERA_PITCH_RAD = (50 * Math.PI) / 180;

interface Walker3d {
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
  material: (view: Overworld3dScene) => StandardMaterial;
  facings?: (view: Overworld3dScene) => Record<ChibiFacing, StandardMaterial>;
  sizeTiles: number;
  glide: boolean;
  alert?: boolean;
}): Visual<Walker3d, Overworld3dScene> {
  return {
    spawn(view, world, e) {
      const pos = world.require(e, OverworldPos), { scene, materials, sunShadows } = view, size = spec.sizeTiles;
      const mesh = standingQuad(scene, "overworld3d-actor", size, size, FOOT_SHARE);
      mesh.material = spec.material(view);
      sunShadows.addShadowCaster(mesh);
      const blob = MeshBuilder.CreateGround("overworld3d-blob", { width: size * 0.7, height: size * 0.35 }, scene);
      blob.material = materials.blob;
      let alert: Mesh | null = null;
      if (spec.alert) {
        alert = standingQuad(scene, "overworld3d-alert", 0.9, 0.9);
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

export const WALKERS_3D: Record<OverworldActorData["kind"], Visual<Walker3d, Overworld3dScene>> = {
  player: walker({ material: (v) => v.materials.player.front, facings: (v) => v.materials.player, sizeTiles: 1.6, glide: false }),
  ...byEnemy(({ sprite }, id) => walker({
    material: (v) => v.materials.enemies[id], sizeTiles: sprite.sizeTiles, glide: true, alert: true,
  })),
};

function drawWalker(w: Walker3d, world: World, e: Entity, dt: number): void {
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

export function overworld3dStage(view: Overworld3dScene): (dt: number, fresh: boolean) => void {
  let level: { layout: LevelLayout; drawing: Level3d } | null = null;
  const target = new Vector3();
  const back = new Vector3(0, Math.sin(CAMERA_PITCH_RAD), -Math.cos(CAMERA_PITCH_RAD)).scale(CAMERA_DISTANCE);
  return (dt, fresh) => {
    const { state, camera } = view;
    if (state.level !== level?.layout) {
      level?.drawing.root.dispose(false, true);
      level = state.level && { layout: state.level, drawing: buildLevel3d(view, state.level) };
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
