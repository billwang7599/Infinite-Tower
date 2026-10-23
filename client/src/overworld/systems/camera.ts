import type { System, World } from "@infinite-tower/shared";
import { MapActor, MapPos } from "../components.js";
import type { MapView } from "../scene.js";

/** Tiles visible above/below the player. */
const VIEW_HALF_HEIGHT = 6.5;

/** Smoothly follow the map player, without showing past the edge of the world. */
export function mapCameraSystem(view: MapView): System {
  return (world, dt) => {
    const me = localPlayer(world);
    if (!me) return;
    const aspect = view.scene.getEngine().getAspectRatio(view.camera);
    const h = VIEW_HALF_HEIGHT, w = h * aspect;
    const cam = view.camera;
    cam.orthoTop = h; cam.orthoBottom = -h; cam.orthoLeft = -w; cam.orthoRight = w;
    const maxX = Math.max(0, view.field.halfWidth + 3 - w), maxZ = Math.max(0, view.field.halfDepth + 3 - h);
    const tx = Math.max(-maxX, Math.min(maxX, me[2].x));
    const tz = Math.max(-maxZ, Math.min(maxZ, me[2].z));
    const k = 1 - Math.exp(-10 * dt);
    cam.position.x += (tx - cam.position.x) * k;
    cam.position.z += (tz - cam.position.z) * k;
  };
}

/** Snap the camera onto the player (after teleporting them). */
export function snapMapCamera(view: MapView, world: World): void {
  const me = localPlayer(world);
  if (me) view.camera.position.set(me[2].x, 30, me[2].z);
}

function localPlayer(world: World) {
  for (const row of world.query(MapActor, MapPos)) if (row[1].kind === "player") return row;
  return undefined;
}
