import {
  dampFactor, VIEW, viewCenter, viewHalfWidth, type Entity, type System, type Vec2,
} from "@infinite-tower/shared";
import { FieldPos } from "../components.js";
import { CAMERA_HEIGHT, type FieldView } from "../scene.js";

/** 1/s, for dampFactor. */
const FOLLOW_RATE = 10;

/** Smoothly follow the local player, without showing past the edge of the level. */
export function fieldCameraSystem(view: FieldView, player: Entity): System {
  return (world, dt) => {
    const level = view.level;
    if (!level) return;
    const h = VIEW.halfHeight, w = viewHalfWidth(view.scene.getEngine().getAspectRatio(view.camera));
    const cam = view.camera;
    cam.orthoTop = h; cam.orthoBottom = -h; cam.orthoLeft = -w; cam.orthoRight = w;
    const to = viewCenter(level, world.require(player, FieldPos), w);
    const k = dampFactor(FOLLOW_RATE, dt);
    cam.position.x += (to.x - cam.position.x) * k;
    cam.position.z += (to.z - cam.position.z) * k;
  };
}

/** Snap the camera onto the player (after the server moved them). */
export function snapFieldCamera(view: FieldView, at: Vec2): void {
  view.camera.position.set(at.x, CAMERA_HEIGHT, at.z);
}
