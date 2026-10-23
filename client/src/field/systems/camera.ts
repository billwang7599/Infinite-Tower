import { clamp, dampFactor, LocalPlayer, type System, type World } from "@infinite-tower/shared";
import { FieldPos } from "../components.js";
import type { FieldView } from "../scene.js";

/** Tiles visible above/below the player. */
const VIEW_HALF_HEIGHT = 6.5;
const FOLLOW_RATE = 10;

/** Smoothly follow the local player, without showing past the edge of the level. */
export function fieldCameraSystem(view: FieldView): System {
  return (world, dt) => {
    const me = world.first(LocalPlayer, FieldPos), level = view.level;
    if (!me || !level) return;
    const aspect = view.scene.getEngine().getAspectRatio(view.camera);
    const h = VIEW_HALF_HEIGHT, w = h * aspect;
    const cam = view.camera;
    cam.orthoTop = h; cam.orthoBottom = -h; cam.orthoLeft = -w; cam.orthoRight = w;
    const maxX = Math.max(0, level.halfWidth + 3 - w), maxZ = Math.max(0, level.halfDepth + 3 - h);
    const k = dampFactor(FOLLOW_RATE, dt);
    cam.position.x += (clamp(me[2].x, -maxX, maxX) - cam.position.x) * k;
    cam.position.z += (clamp(me[2].z, -maxZ, maxZ) - cam.position.z) * k;
  };
}

/** Snap the camera onto the player (after the server moved them). */
export function snapFieldCamera(view: FieldView, world: World): void {
  const me = world.first(LocalPlayer, FieldPos);
  if (me) view.camera.position.set(me[2].x, 30, me[2].z);
}
