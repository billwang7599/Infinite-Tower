import { Color3, Quaternion, Vector3 } from "@babylonjs/core";
import {
  Body, damp, dampFactor, Enemy, Health, isSwing, SwordAttack, wrapAngle, type AttackKind, type System,
} from "@infinite-tower/shared";
import { SCREEN_DIR } from "../../../player/pose.js";
import { KoboldModel } from "./model.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
/** The blade on guard: up and forward, toward whoever it faces. */
const GUARD_DIR = new Vector3(0.25, 0.7, 0.65).normalize();
/** The blade as it ends a stab, and drawn back before one. */
const STAB_DIR = new Vector3(0, 0.08, 1).normalize();
/** How far forward (m) a wound-up blade leans, on either side of its swing. */
const WINDUP_LEAN = 0.35;

/**
 * Where a swing starts, in the kobold's own frame (+z ahead): the far end of its line from where it's going. Its
 * way across the screen is as the player facing the kobold sees it, so the kobold's x is the screen's, mirrored.
 */
function swingStart(attack: AttackKind): Vector3 {
  if (!isSwing(attack)) return STAB_DIR;
  const { x, y } = SCREEN_DIR[attack];
  return new Vector3(x, -y, 0);
}

const pointBlade = (dir: Vector3, out: Quaternion) => Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir, out);

/**
 * Per render frame: the kobold's animation from its enemy state. Each swing reads before it lands: in the wind-up
 * the blade swings round to where it will start from and an arrow in front points the way it will go (a ring for
 * a stab); then the blade sweeps through. Parried, staggered or stunned, it reels.
 */
export function koboldAnimationSystem(): System {
  const blade = new Quaternion(), dir = new Vector3();

  return (world, dt) => {
    for (const [e, nodes, enemy, health, body] of world.query(KoboldModel, Enemy, Health, Body)) {
      const speed = Math.hypot(body.vel.x, body.vel.z);
      nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(15, dt);
      nodes.root.rotation.y = nodes.visualYaw;
      nodes.gait += dt * speed * 3;
      const amp = Math.min(0.7, speed * 0.25);
      nodes.legs[0].rotation.x = Math.sin(nodes.gait) * amp;
      nodes.legs[1].rotation.x = -Math.sin(nodes.gait) * amp;

      const sword = world.get(e, SwordAttack);
      const attack = sword?.attack ?? "lr";
      const state = health.hp > 0 ? enemy.state : "dead";
      const t = enemy.stateTime, k = enemy.duration > 0 ? Math.min(1, t / enemy.duration) : 1;
      let lean = 0, roll = 0, handZ = 0.28, yOff = 0, tell = 0;
      dir.copyFrom(GUARD_DIR);
      switch (state) {
        case "swordWindup": {
          const start = swingStart(attack);
          Vector3.LerpToRef(GUARD_DIR, isSwing(attack) ? new Vector3(start.x, start.y, WINDUP_LEAN) : STAB_DIR, k, dir);
          if (!isSwing(attack)) handZ = 0.28 - 0.3 * k;
          lean = -0.12 * k;
          tell = 0.25 + 0.75 * k;
          break;
        }
        case "sword": {
          const p = Math.min(1, t / Math.max(0.01, sword?.def.active ?? 0.1));
          if (isSwing(attack)) {
            // From the start, through straight ahead, to the line's other end.
            const start = swingStart(attack), a = Math.PI * p;
            dir.set(start.x * Math.cos(a), start.y * Math.cos(a), Math.sin(a) + 0.15);
          } else {
            dir.copyFrom(STAB_DIR);
            handZ = 0.28 + 0.45 * Math.sin(Math.PI * p);
          }
          lean = 0.15;
          break;
        }
        case "swordRecover":
          dir.set(0.3, -0.6, 0.5);
          lean = 0.08 * (1 - k);
          break;
        case "parried":
        case "stunned":
        case "staggered":
          dir.set(0.6, -0.5, -0.2);
          lean = -0.3;
          roll = Math.sin(t * (state === "staggered" ? 14 : 6)) * 0.18;
          break;
        case "dead":
          dir.set(0.8, -0.4, 0);
          roll = Math.PI / 2;
          yOff = 0.25;
          break;
      }
      pointBlade(dir.normalize(), blade);
      nodes.hand.rotationQuaternion ??= new Quaternion();
      Quaternion.SlerpToRef(nodes.hand.rotationQuaternion, blade, state === "sword" ? 1 : dampFactor(18, dt),
        nodes.hand.rotationQuaternion);
      nodes.hand.position.z = damp(nodes.hand.position.z, handZ, 20, dt);
      nodes.model.rotation.x = damp(nodes.model.rotation.x, lean, 10, dt);
      nodes.model.rotation.z = damp(nodes.model.rotation.z, roll, state === "dead" ? 6 : 12, dt);
      nodes.model.position.y = damp(nodes.model.position.y, yOff, 8, dt);

      const stunned = state === "parried" || state === "stunned";
      nodes.stars.setEnabled(stunned);
      if (stunned) nodes.stars.rotation.y += dt * 5;

      // The tell: an arrow along the swing's way across the player's screen, or a ring for a stab.
      const showArrow = tell > 0 && isSwing(attack), showRing = tell > 0 && !isSwing(attack);
      nodes.arrow.setEnabled(showArrow);
      nodes.ring.setEnabled(showRing);
      if (showArrow) {
        const { x, y } = SCREEN_DIR[attack];
        // Its +y along (-x, y) in the kobold's frame: the screen's x is mirrored, seen from in front.
        nodes.arrow.rotation.z = Math.atan2(x, y);
      }
      for (const m of nodes.arrow.getChildMeshes()) m.visibility = tell;
      nodes.ring.visibility = tell;

      for (let i = 0; i < nodes.materials.length; i++) {
        nodes.materials[i]!.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : nodes.baseEmissive[i]!);
      }
    }
  };
}
