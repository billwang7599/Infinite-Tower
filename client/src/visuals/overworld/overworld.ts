import { Vector3 } from "@babylonjs/core";
import { damp, dampFactor, wrapAngle } from "@infinite-tower/shared";
import { OverworldPos } from "../../modes/overworld/components.js";
import { floorReach, orbitBack } from "../../modes/orbit.js";
import { CAMERA, type OverworldScene } from "./scene.js";
import { worldDrawing, type WorldDrawing } from "./chunks.js";
import { terrainArt, type TerrainArt } from "./terrainArt.js";
import { stepped } from "./motion.js";
import { QUARTER_TURN_RAD } from "./walker.js";

const CAMERA_FOLLOW_RATE = 10;
/** Turning and tilting ease in over a few frames, so key turns stepped at the fixed rate don't judder. */
const CAMERA_TURN_RATE = 20;
const ZOOM_RATE = 6;
/** Tilted under, the camera stays this far above the ground. */
const FLOOR_MARGIN_TILES = 0.15;

export interface OverworldStage {
  frame(dt: number, fresh: boolean): void;
  /** While a fight is on: the chunks round where you'll come back to are built ahead. */
  warm(): void;
}

export function overworldStage(view: OverworldScene): OverworldStage {
  let art: TerrainArt | null = null, world: WorldDrawing | null = null;
  const target = new Vector3(0, CAMERA.pivotTiles, 0), feet = { x: 0, y: 0, z: 0 };
  let facedYaw = NaN, distanceTiles = view.state.cameraDistanceTiles, pitchRad = view.state.cameraPitchRad;
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
    const turnK = fresh ? 1 : dampFactor(CAMERA_TURN_RATE, dt);
    view.yawRad += wrapAngle(wantedRad - view.yawRad) * turnK;
    if (Math.abs(wrapAngle(wantedRad - view.yawRad)) < 1e-4) view.yawRad = wantedRad;
    pitchRad += (state.cameraPitchRad - pitchRad) * turnK;
    if (view.yawRad !== facedYaw) world.face(facedYaw = view.yawRad);
    const player = stepped(state.playerFrom, state.world.require(state.player, OverworldPos), state.stepFraction);
    const k = fresh ? 1 : dampFactor(CAMERA_FOLLOW_RATE, dt);
    target.x += (player.x - target.x) * k;
    target.z += (player.z - target.z) * k;
    distanceTiles = fresh ? state.cameraDistanceTiles : damp(distanceTiles, state.cameraDistanceTiles, ZOOM_RATE, dt);
    const back = orbitBack(view.yawRad, pitchRad);
    const dist = floorReach(CAMERA.pivotTiles, back.y, 0, distanceTiles, FLOOR_MARGIN_TILES);
    camera.position.set(target.x + back.x * dist, target.y + back.y * dist, target.z + back.z * dist);
    camera.setTarget(target);
    view.sky.frame(Date.now(), camera.position);
    feet.x = target.x;
    feet.z = target.z;
    world.frame(dt, camera.position, feet);
  };
  return { frame, warm };
}
