import { Matrix, Quaternion, Vector3, type TargetCamera } from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";

const look = new Matrix(), target = new Vector3(), up = new Vector3();

// setTarget keeps a camera upright, so it would flip passing straight up or down; this rolls with `upward`.
export function aimCamera(camera: TargetCamera, eye: Vec3, at: Vec3, upward: Vec3): void {
  camera.position.set(eye.x, eye.y, eye.z);
  Matrix.LookAtLHToRef(camera.position, target.set(at.x, at.y, at.z), up.set(upward.x, upward.y, upward.z), look);
  look.invert();
  Quaternion.FromRotationMatrixToRef(look, camera.rotationQuaternion ??= new Quaternion());
}
