import { dampFactor, distXZ, inTallGrass, type System } from "@infinite-tower/shared";
import { FieldActor, FieldPos, FieldSprite } from "../components.js";
import { layerY, type FieldView } from "../scene.js";

/** Server snapshots arrive ~20x/s: glide toward them (1/s, for dampFactor); snap if far off (respawn, teleport). */
const GLIDE_RATE = 14;
const SNAP_DIST_TILES = 3;
/** Slower than this (tiles/s) counts as standing: no walk hop. */
const MOVING_SPEED = 0.1;
const WALK_CYCLE_RAD_PER_SEC = 12;
const HOP_TILES = 0.12;
/** The quad's center sits this share of its size above the feet (in +z), so the feet stay on the position. */
const FOOT_OFFSET = 0.4;

/** Per render frame: glide to server positions, place the quads, walk hop, facing, tuft and "!". */
export function fieldSpriteSystem(view: FieldView): System {
  return (world, dt) => {
    for (const [, sprite, pos, actor] of world.query(FieldSprite, FieldPos, FieldActor)) {
      if (actor.target) {
        const k = distXZ(pos, actor.target) > SNAP_DIST_TILES ? 1 : dampFactor(GLIDE_RATE, dt);
        pos.x += (actor.target.x - pos.x) * k;
        pos.z += (actor.target.z - pos.z) * k;
      }
      const moving = Math.hypot(actor.vx, actor.vz) > MOVING_SPEED;
      sprite.walkPhase = moving ? sprite.walkPhase + dt * WALK_CYCLE_RAD_PER_SEC : 0;
      const hop = Math.abs(Math.sin(sprite.walkPhase)) * HOP_TILES;

      sprite.mesh.position.set(pos.x, layerY(pos.z, 0.3), pos.z + sprite.size * FOOT_OFFSET + hop);
      sprite.mesh.scaling.x = actor.facing;

      // In tall grass, a tuft covers the feet (and rustles while walking).
      if (sprite.tuft) {
        const inGrass = view.level !== null && inTallGrass(view.level, pos.x, pos.z);
        sprite.tuft.setEnabled(inGrass);
        if (inGrass) {
          sprite.tuft.position.set(pos.x, layerY(pos.z, 0.35), pos.z + 0.12);
          sprite.tuft.scaling.x = moving && Math.sin(sprite.walkPhase * 2) > 0 ? -1 : 1;
        }
      }

      if (sprite.alert) {
        sprite.alert.setEnabled(actor.alert);
        if (actor.alert) sprite.alert.position.set(pos.x + 0.2 * actor.facing, 0.6, pos.z + sprite.size * 0.95);
      }
    }
  };
}
