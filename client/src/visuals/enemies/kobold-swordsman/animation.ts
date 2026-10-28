import { Color3, Quaternion, Vector3 } from "@babylonjs/core";
import {
  Body, damp, dampFactor, Enemy, Health, weaponItemIn, WEAPONS, Wielder, wrapAngle,
} from "@infinite-tower/shared";
import { fighter } from "../../battle/battle.js";
import { MOTIONS, WEAPON_LOOKS, type WeaponMotion } from "../../battle/weapons.js";
import { buildKobold, disposeKobold, type KoboldModel } from "./model.js";
import { koboldPose } from "./pose.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const bladeDir = new Vector3();

export const koboldVisual = fighter<KoboldModel & { blade: Quaternion; motion: WeaponMotion }>("enemy", {
  spawn(ctx, world, e, node) {
    const enemy = world.require(e, Enemy), held = weaponItemIn(world.require(e, Wielder).hands);
    const model = buildKobold(ctx, e, node, enemy.def, enemy.yaw, held && WEAPON_LOOKS[held].blade);
    // Empty-handed, its hand still moves like a sword's.
    return { ...model, blade: new Quaternion(), motion: MOTIONS[held ? WEAPONS[held].kind : "sword"] };
  },
  dispose: disposeKobold,
  frame(nodes, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    const speed = Math.hypot(body.vel.x, body.vel.z);
    nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(15, dt);
    nodes.root.rotation.y = nodes.visualYaw;
    nodes.gait += dt * speed * 3;
    const amp = Math.min(0.7, speed * 0.25);
    nodes.legs[0].rotation.x = Math.sin(nodes.gait) * amp;
    nodes.legs[1].rotation.x = -Math.sin(nodes.gait) * amp;

    const swing = world.get(e, Wielder)?.swing;
    const t = enemy.stateTime, k = enemy.duration > 0 ? Math.min(1, t / enemy.duration) : 1;
    const pose = koboldPose(health.hp > 0 ? enemy.state : "dead", t, k, swing?.attack ?? "lr", nodes.motion);
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), bladeDir.set(pose.blade.x, pose.blade.y, pose.blade.z), nodes.blade);
    nodes.hand.rotationQuaternion ??= new Quaternion();
    Quaternion.SlerpToRef(nodes.hand.rotationQuaternion, nodes.blade, pose.bladeExact ? 1 : dampFactor(18, dt),
      nodes.hand.rotationQuaternion);
    nodes.hand.position.z = damp(nodes.hand.position.z, pose.handZ, 20, dt);
    nodes.model.rotation.x = damp(nodes.model.rotation.x, pose.lean, 10, dt);
    nodes.model.rotation.z = damp(nodes.model.rotation.z, pose.roll, pose.rollRate, dt);
    nodes.model.position.y = damp(nodes.model.position.y, pose.yOff, 8, dt);

    nodes.stars.setEnabled(pose.stars);
    if (pose.stars) nodes.stars.rotation.y += dt * 5;
    nodes.arrow.setEnabled(pose.arrowRad !== null);
    nodes.ring.setEnabled(pose.tell > 0 && pose.arrowRad === null);
    if (pose.arrowRad !== null) nodes.arrow.rotation.z = pose.arrowRad;
    for (const m of nodes.arrow.getChildMeshes()) m.visibility = pose.tell;
    nodes.ring.visibility = pose.tell;

    for (let i = 0; i < nodes.materials.length; i++) {
      nodes.materials[i]!.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : nodes.baseEmissive[i]!);
    }
  },
});
