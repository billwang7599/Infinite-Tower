import { Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import { Body, type System } from "@infinite-tower/shared";
import type { BattleContext } from "./context.js";

const MARKER_GAP_M = 0.5;
const MARKER_SPIN_RAD_PER_SEC = 2.5;

export function lockMarkerSystem(ctx: BattleContext): System {
  const marker = MeshBuilder.CreatePolyhedron("lock-marker", { type: 1, size: 0.12 }, ctx.scene);
  marker.scaling.y = 1.8;
  const material = new StandardMaterial("lock-marker", ctx.scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(1.3, 0.35, 0.25);
  marker.material = material;
  marker.isPickable = false;

  return (world, dt) => {
    const body = ctx.lock === null ? undefined : world.get(ctx.lock, Body);
    marker.setEnabled(body !== undefined);
    if (!body) return;
    marker.position.set(body.pos.x, body.pos.y + 2 * body.centerHeight + MARKER_GAP_M, body.pos.z);
    marker.rotation.y += MARKER_SPIN_RAD_PER_SEC * dt;
  };
}
