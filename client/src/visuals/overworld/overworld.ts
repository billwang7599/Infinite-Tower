import type { Mesh, StandardMaterial } from "@babylonjs/core";
import {
  dampFactor, distXZ, inTallGrass, VIEW, viewCenter, viewHalfWidth, type Entity, type LevelLayout, type Vec2,
  type World,
} from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import { OverworldActor, OverworldPos, type OverworldActorData } from "../../modes/overworld/components.js";
import { mirrorFor, type Facing } from "../../modes/overworld/facing.js";
import { byEnemy } from "../enemies/index.js";
import { buildLevel, type LevelDrawing } from "../levels/index.js";
import type { Visual } from "../visuals.js";
import { CAMERA_HEIGHT, flatSprite, layerY, type OverworldScene } from "./scene.js";

/** Server snapshots arrive ~20x/s: glide toward them (1/s, for dampFactor); snap if far off (respawn, teleport). */
const GLIDE_RATE = 14;
const SNAP_DIST_TILES = 3;
/** Slower than this (tiles/s) counts as standing: no walk hop. */
const MOVING_SPEED = 0.1;
const WALK_CYCLE_RAD_PER_SEC = 12;
const HOP_TILES = 0.12;
/** The quad's center sits this share of its size above the feet (in +z), so the feet stay on the position. */
const FOOT_OFFSET = 0.4;
/** How fast the camera follows the player (1/s, for dampFactor). */
const CAMERA_FOLLOW_RATE = 10;
/** The chibi's picture for each way it walks: the front faces the camera, "down" the screen. */
export const CHIBI_FACING = {
  down: "front", up: "back", left: "side", right: "side",
} as const satisfies Record<Facing, ChibiFacing>;

interface Walker {
  view: OverworldScene;
  mesh: Mesh;
  /** A picture for each way it can face (the player's chibi); null for actors with one picture. */
  facings: Record<ChibiFacing, StandardMaterial> | null;
  alert: Mesh | null;
  /** Grass drawn over the feet in tall grass. */
  tuft: Mesh | null;
  /** Tiles across. */
  size: number;
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
  tuft?: boolean;
}): Visual<Walker, OverworldScene> {
  return {
    spawn(view, world, e) {
      const pos = world.require(e, OverworldPos), { scene, materials } = view;
      return {
        view,
        mesh: flatSprite(scene, "overworld-actor", spec.sizeTiles, spec.material(view)),
        facings: spec.facings?.(view) ?? null,
        alert: spec.alert ? hidden(flatSprite(scene, "overworld-alert", 0.9, materials.alert)) : null,
        tuft: spec.tuft ? hidden(flatSprite(scene, "overworld-tuft", 1.1, materials.tuft)) : null,
        size: spec.sizeTiles,
        drawn: { x: pos.x, z: pos.z },
        glide: spec.glide,
        walkPhase: 0,
      };
    },
    frame: drawWalker,
    dispose(w) {
      w.mesh.dispose();
      w.alert?.dispose();
      w.tuft?.dispose();
    },
  };
}

export const WALKERS: Record<OverworldActorData["kind"], Visual<Walker, OverworldScene>> = {
  player: walker({
    material: (v) => v.materials.player.front, facings: (v) => v.materials.player, sizeTiles: 1.6, glide: false,
    tuft: true,
  }),
  ...byEnemy(({ sprite }, id) => walker({
    material: (v) => v.materials.enemies[id], sizeTiles: sprite.sizeTiles, glide: true, alert: true,
  })),
};

function hidden(mesh: Mesh): Mesh {
  mesh.setEnabled(false);
  return mesh;
}

export function glideWalker(
  w: { drawn: Vec2; glide: boolean; walkPhase: number }, world: World, e: Entity, dt: number,
): { actor: OverworldActorData; moving: boolean; hop: number } {
  const pos = world.require(e, OverworldPos), actor = world.require(e, OverworldActor), at = w.drawn;
  const k = !w.glide || distXZ(at, pos) > SNAP_DIST_TILES ? 1 : dampFactor(GLIDE_RATE, dt);
  at.x += (pos.x - at.x) * k;
  at.z += (pos.z - at.z) * k;
  const moving = Math.hypot(actor.vx, actor.vz) > MOVING_SPEED;
  w.walkPhase = moving ? w.walkPhase + dt * WALK_CYCLE_RAD_PER_SEC : 0;
  return { actor, moving, hop: Math.abs(Math.sin(w.walkPhase)) * HOP_TILES };
}

function drawWalker(w: Walker, world: World, e: Entity, dt: number): void {
  const { actor, moving, hop } = glideWalker(w, world, e, dt), at = w.drawn;
  const { level } = w.view.state;

  w.mesh.position.set(at.x, layerY(at.z, 0.3), at.z + w.size * FOOT_OFFSET + hop);
  w.mesh.scaling.x = mirrorFor(actor.facing);
  if (w.facings) {
    const material = w.facings[CHIBI_FACING[actor.facing]];
    if (w.mesh.material !== material) w.mesh.material = material;
  }

  // In tall grass, a tuft covers the feet (and rustles while walking).
  if (w.tuft) {
    const inGrass = level !== null && inTallGrass(level, at.x, at.z);
    w.tuft.setEnabled(inGrass);
    if (inGrass) {
      w.tuft.position.set(at.x, layerY(at.z, 0.35), at.z + 0.12);
      w.tuft.scaling.x = moving && Math.sin(w.walkPhase * 2) > 0 ? -1 : 1;
    }
  }

  if (w.alert) {
    w.alert.setEnabled(actor.alert);
    if (actor.alert) w.alert.position.set(at.x + 0.2 * mirrorFor(actor.facing), 0.6, at.z + w.size * 0.95);
  }
}

export function overworldStage(view: OverworldScene): (dt: number, fresh: boolean) => void {
  let level: { layout: LevelLayout; drawing: LevelDrawing } | null = null;
  return (dt, fresh) => {
    const { state, camera: cam } = view;
    if (state.level !== level?.layout) {
      level?.drawing.root.dispose(false, true);
      level = state.level && { layout: state.level, drawing: buildLevel(view.scene, state.level) };
      fresh = true;
    }
    if (!level) return;
    level.drawing.flicker(dt);
    const player = state.world.require(state.player, OverworldPos);
    if (fresh) cam.position.set(player.x, CAMERA_HEIGHT, player.z);
    const h = VIEW.halfHeight, w = viewHalfWidth(view.scene.getEngine().getAspectRatio(cam));
    cam.orthoTop = h; cam.orthoBottom = -h; cam.orthoLeft = -w; cam.orthoRight = w;
    const to = viewCenter(level.layout, player, w);
    const k = dampFactor(CAMERA_FOLLOW_RATE, dt);
    cam.position.x += (to.x - cam.position.x) * k;
    cam.position.z += (to.z - cam.position.z) * k;
  };
}
