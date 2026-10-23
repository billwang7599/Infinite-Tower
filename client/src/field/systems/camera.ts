import { dampFactor, LocalPlayer, VIEW, viewCenter, viewHalfWidth, type System, type World } from "@infinite-tower/shared";
import { FieldPos } from "../components.js";
import type { FieldView } from "../scene.js";

const FOLLOW_RATE = 10;

/** Smoothly follow the local player, without showing past the edge of the level. */
export function fieldCameraSystem(view: FieldView): System {
  return (world, dt) => {
    const me = world.first(LocalPlayer, FieldPos), level = view.level;
    if (!me || !level) return;
    const h = VIEW.halfHeight, w = viewHalfWidth(view.scene.getEngine().getAspectRatio(view.camera));
    const cam = view.camera;
    cam.orthoTop = h; cam.orthoBottom = -h; cam.orthoLeft = -w; cam.orthoRight = w;
    const to = viewCenter(level, me[2], w);
    const k = dampFactor(FOLLOW_RATE, dt);
    cam.position.x += (to.x - cam.position.x) * k;
    cam.position.z += (to.z - cam.position.z) * k;
  };
}

/** Snap the camera onto the player (after the server moved them). */
export function snapFieldCamera(view: FieldView, world: World): void {
  const me = world.first(LocalPlayer, FieldPos);
  if (me) view.camera.position.set(me[2].x, 30, me[2].z);
}
