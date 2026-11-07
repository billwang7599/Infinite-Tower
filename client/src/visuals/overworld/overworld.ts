import { Vector3 } from "@babylonjs/core";
import { dampFactor, wrapAngle } from "@infinite-tower/shared";
import { OverworldPos } from "../../modes/overworld/components.js";
import { floorReach, orbitBack, orbitUp } from "../../modes/orbit.js";
import { aimCamera } from "../aim.js";
import { CAMERA, type OverworldScene } from "./scene.js";
import { worldDrawing, type WorldDrawing } from "./chunks.js";
import { terrainArt, type TerrainArt } from "./terrainArt.js";
import { QUARTER_TURN_RAD } from "./walker.js";

const CAMERA_FOLLOW_RATE = 10;
/** Tilted under, the camera stays this far above the ground. */
const FLOOR_MARGIN_TILES = 0.15;

export interface OverworldStage {
  frame(dt: number, fresh: boolean): void;
  /** While a fight is on: the chunks round where you'll come back to are built ahead. */
  warm(): void;
}

export function overworldStage(view: OverworldScene): OverworldStage {
  let art: TerrainArt | null = null, world: WorldDrawing | null = null;
  const target = new Vector3(0, CAMERA.pivotTiles, 0), eye = { x: 0, y: 0, z: 0 }, feet = { x: 0, y: 0, z: 0 };
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
    view.yawRad = fresh ? wantedRad : view.yawRad + wrapAngle(wantedRad - view.yawRad);
    if (view.yawRad !== facedYaw) world.face(facedYaw = view.yawRad);
    const player = state.world.require(state.player, OverworldPos);
    const k = fresh ? 1 : dampFactor(CAMERA_FOLLOW_RATE, dt);
    target.x += (player.x - target.x) * k;
    target.z += (player.z - target.z) * k;
    const back = orbitBack(view.yawRad, state.cameraPitchRad);
    const dist = floorReach(CAMERA.pivotTiles, back.y, 0, CAMERA.distanceTiles, FLOOR_MARGIN_TILES);
    Object.assign(eye, { x: target.x + back.x * dist, y: target.y + back.y * dist, z: target.z + back.z * dist });
    aimCamera(camera, eye, target, orbitUp(view.yawRad, state.cameraPitchRad));
    view.sky.frame(Date.now(), camera.position);
    feet.x = target.x;
    feet.z = target.z;
    world.frame(dt, camera.position, feet);
  };
  return { frame, warm };
}
