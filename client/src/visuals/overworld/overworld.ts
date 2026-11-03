import { Vector3 } from "@babylonjs/core";
import { dampFactor, wrapAngle } from "@infinite-tower/shared";
import { OverworldPos } from "../../modes/overworld/components.js";
import { CAMERA_TURN_TIME } from "../../modes/overworld/facing.js";
import type { OverworldScene } from "./scene.js";
import { worldDrawing, type WorldDrawing } from "./chunks.js";
import { terrainArt, type TerrainArt } from "./terrainArt.js";
import { QUARTER_TURN_RAD } from "./walker.js";

const CAMERA_FOLLOW_RATE = 10;
const CAMERA_DISTANCE = 21;

export interface OverworldStage {
  frame(dt: number, fresh: boolean): void;
  /** While a fight is on: the chunks round where you'll come back to are built ahead. */
  warm(): void;
}

export function overworldStage(view: OverworldScene): OverworldStage {
  let art: TerrainArt | null = null, world: WorldDrawing | null = null;
  const target = new Vector3(), back = new Vector3(), feet = { x: 0, y: 0, z: 0 };
  const turn = { fromRad: 0, toRad: 0, time: CAMERA_TURN_TIME };
  let facedYaw = NaN;
  const follow = () => {
    if (view.state.map === world?.map) return false;
    world?.dispose();
    world = view.state.map && worldDrawing(view, view.state, art ??= terrainArt(view.scene));
    facedYaw = NaN;
    return true;
  };
  const warm = () => {
    follow();
    const at = view.state.world.get(view.state.player, OverworldPos);
    if (world && at) world.warm({ x: at.x, y: 0, z: at.z });
  };
  const frame = (dt: number, fresh: boolean) => {
    const { state, camera } = view;
    if (follow()) fresh = true;
    if (!world) return;
    const wantedRad = state.cameraTurns * QUARTER_TURN_RAD;
    if (fresh) Object.assign(turn, { fromRad: wantedRad, toRad: wantedRad, time: CAMERA_TURN_TIME });
    else if (Math.abs(wrapAngle(wantedRad - turn.toRad)) > 1e-6) {
      Object.assign(turn, { fromRad: view.yawRad, toRad: view.yawRad + wrapAngle(wantedRad - view.yawRad), time: 0 });
    }
    turn.time = Math.min(turn.time + dt, CAMERA_TURN_TIME);
    const share = turn.time / CAMERA_TURN_TIME;
    view.yawRad = turn.fromRad + (turn.toRad - turn.fromRad) * share * share * (3 - 2 * share);
    if (view.yawRad !== facedYaw) world.face(facedYaw = view.yawRad);
    const flat = Math.cos(state.cameraPitchRad) * CAMERA_DISTANCE;
    back.set(
      -Math.sin(view.yawRad) * flat, Math.sin(state.cameraPitchRad) * CAMERA_DISTANCE, -Math.cos(view.yawRad) * flat,
    );
    const player = state.world.require(state.player, OverworldPos);
    const k = fresh ? 1 : dampFactor(CAMERA_FOLLOW_RATE, dt);
    target.x += (player.x - target.x) * k;
    target.z += (player.z - target.z) * k;
    camera.position.copyFrom(target).addInPlace(back);
    camera.setTarget(target);
    view.sky.frame(Date.now(), camera.position);
    feet.x = target.x;
    feet.z = target.z;
    world.frame(dt, camera.position, feet);
  };
  return { frame, warm };
}
