import { inTallGrass, MapBoar, MapPlayer, MapPos, type System } from "@infinite-tower/shared";
import { MapSprite } from "../components.js";
import { layerY } from "../scene.js";

/** Per render frame: place the quads, walk hop, facing, tall-grass tuft and the "!" bubble. */
export function mapSpriteSystem(): System {
  return (world, dt) => {
    for (const [e, sprite, pos] of world.query(MapSprite, MapPos)) {
      const mp = world.get(e, MapPlayer), boar = world.get(e, MapBoar);
      const vx = mp?.vx ?? boar?.vx ?? 0, vz = mp?.vz ?? boar?.vz ?? 0;
      const facing = mp?.facing ?? boar?.facing ?? 1;
      const moving = Math.hypot(vx, vz) > 0.1;
      sprite.walkPhase = moving ? sprite.walkPhase + dt * 12 : 0;
      const hop = Math.abs(Math.sin(sprite.walkPhase)) * 0.12;

      // Sprites are anchored at their feet: the quad's center sits half a size above (in +z).
      const footOffset = sprite.size * 0.4;
      sprite.mesh.position.set(pos.x, layerY(pos.z, 0.3), pos.z + footOffset + hop);
      sprite.mesh.scaling.x = facing;

      // In tall grass, a tuft covers the feet (and rustles while walking).
      if (sprite.tuft) {
        const inGrass = inTallGrass(pos.x, pos.z);
        sprite.tuft.setEnabled(inGrass);
        if (inGrass) {
          sprite.tuft.position.set(pos.x, layerY(pos.z, 0.35), pos.z + 0.12);
          sprite.tuft.scaling.x = moving && Math.sin(sprite.walkPhase * 2) > 0 ? -1 : 1;
        }
      }

      if (sprite.alert) {
        const show = boar?.state === "notice" || boar?.state === "chase";
        sprite.alert.setEnabled(show);
        if (show) sprite.alert.position.set(pos.x + 0.2 * facing, 0.6, pos.z + sprite.size * 0.95);
      }
    }
  };
}
