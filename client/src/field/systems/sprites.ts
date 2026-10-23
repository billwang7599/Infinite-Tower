import { dampFactor, distXZ, inTallGrass, type System } from "@infinite-tower/shared";
import { FieldActor, FieldPos, FieldSprite } from "../components.js";
import { layerY, type FieldView } from "../scene.js";

/** Server snapshots arrive ~20x/s: glide toward them; snap if far off (respawn, teleport). */
const GLIDE_RATE = 14;
const SNAP_DIST = 3;

/** Per render frame: glide to server positions, place the quads, walk hop, facing, tuft and "!". */
export function fieldSpriteSystem(view: FieldView): System {
  return (world, dt) => {
    for (const [, sprite, pos, actor] of world.query(FieldSprite, FieldPos, FieldActor)) {
      if (actor.target) {
        const k = distXZ(pos, actor.target) > SNAP_DIST ? 1 : dampFactor(GLIDE_RATE, dt);
        pos.x += (actor.target.x - pos.x) * k;
        pos.z += (actor.target.z - pos.z) * k;
      }
      const moving = Math.hypot(actor.vx, actor.vz) > 0.1;
      sprite.walkPhase = moving ? sprite.walkPhase + dt * 12 : 0;
      const hop = Math.abs(Math.sin(sprite.walkPhase)) * 0.12;

      // Sprites are anchored at their feet: the quad's center sits half a size above (in +z).
      const footOffset = sprite.size * 0.4;
      sprite.mesh.position.set(pos.x, layerY(pos.z, 0.3), pos.z + footOffset + hop);
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
