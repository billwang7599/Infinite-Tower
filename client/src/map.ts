/**
 * The overworld: a top-down 2D grass field rendered by its own Babylon scene with an orthographic
 * camera. Everything is a flat textured quad. Rules live in shared/src/overworld.ts; this file only
 * builds the scene, spawns map entities and draws them.
 */
import {
  Camera, Color4, DynamicTexture, FreeCamera, Mesh, MeshBuilder, Scene, StandardMaterial, Texture, Vector3, type Engine,
} from "@babylonjs/core";
import {
  defineComponent, inTallGrass, MAP, MapBoar, MapPlayer, MapPos, PlayerInput, type Entity, type System, type Vec2, type World,
} from "@infinite-tower/shared";
import type { Keyboard } from "./input.js";
import { rng } from "./materials.js";
import { drawAlert, drawBoar, drawPlayerIdle, spriteMaterial, spriteTexture } from "./sprites.js";

export interface MapView {
  scene: Scene;
  camera: FreeCamera;
  materials: { player: StandardMaterial; boar: StandardMaterial; alert: StandardMaterial; tuft: StandardMaterial };
}

/** The quad drawing a map entity (plus an optional "!" bubble). */
export interface MapSpriteData {
  mesh: Mesh;
  /** "!" bubble (boars). */
  alert: Mesh | null;
  /** Grass drawn over the feet in tall grass (player). */
  tuft: Mesh | null;
  size: number;
  walkPhase: number;
}
export const MapSprite = defineComponent<MapSpriteData>("MapSprite");

export function registerMapDisposers(world: World): void {
  world.onRemove(MapSprite, (_e, s) => {
    s.mesh.dispose();
    s.alert?.dispose();
    s.tuft?.dispose();
  });
}

/** Sprites lower on screen draw on top (classic top-down layering): nudge them toward the camera. */
const layerY = (z: number, base: number) => base - z * 0.002;

/** A flat material that ignores lighting: the map is pure 2D. */
function flat(scene: Scene, name: string, tex: DynamicTexture): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.disableLighting = true;
  return m;
}

function pixelTexture(scene: Scene, name: string, size: number, draw: (ctx: CanvasRenderingContext2D) => void): DynamicTexture {
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  draw(ctx);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

export function createMap(engine: Engine): MapView {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.16, 0.3, 0.16, 1);
  scene.skipPointerMovePicking = true;

  // Straight-down orthographic camera: +x right, +z up on screen.
  const camera = new FreeCamera("map-camera", new Vector3(0, 30, 0), scene);
  camera.rotation.set(Math.PI / 2, 0, 0);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 100;
  camera.inputs.clear();

  const r = rng(11);
  const W = MAP.halfWidth, D = MAP.halfDepth;

  // Short grass: 16 texels per tile, an 8x8-tile texture (big enough that the repeat isn't obvious).
  const grassTex = pixelTexture(scene, "map-grass", 128, (ctx) => {
    ctx.fillStyle = "#5fa84e";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 560; i++) {
      ctx.fillStyle = ["#6fbb5a", "#529646", "#79c463", "#4b8c40"][Math.floor(r() * 4)]!;
      ctx.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 1 + Math.floor(r() * 2), 1);
    }
    for (let i = 0; i < 9; i++) { // little flowers
      const x = 1 + Math.floor(r() * 124), y = 1 + Math.floor(r() * 124);
      ctx.fillStyle = r() < 0.5 ? "#f4f0d8" : "#f2c94c";
      ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillRect(x + 2, y, 1, 1);
    }
  });
  grassTex.uScale = (W * 2 + 8) / 8;
  grassTex.vScale = (D * 2 + 8) / 8;
  const ground = MeshBuilder.CreateGround("map-ground", { width: W * 2 + 8, height: D * 2 + 8 }, scene);
  ground.material = flat(scene, "map-grass", grassTex);

  // Tall grass: two tufts per tile, darker and dense.
  const tallTex = pixelTexture(scene, "map-tall-grass", 16, (ctx) => {
    ctx.fillStyle = "#3d7f36";
    ctx.fillRect(0, 0, 16, 16);
    const tuft = (x: number, y: number) => {
      ctx.fillStyle = "#2c6128"; ctx.fillRect(x, y + 5, 7, 2);
      ctx.fillStyle = "#62b24f";
      ctx.fillRect(x, y + 1, 1, 4); ctx.fillRect(x + 3, y, 1, 5); ctx.fillRect(x + 6, y + 1, 1, 4);
      ctx.fillStyle = "#86d06a";
      ctx.fillRect(x + 1, y + 2, 1, 3); ctx.fillRect(x + 4, y + 1, 1, 3); ctx.fillRect(x + 5, y + 3, 1, 2);
    };
    tuft(0, 1); tuft(8, 9); tuft(9, 0); tuft(1, 9);
  });
  const g = MAP.grass;
  tallTex.uScale = g.w;
  tallTex.vScale = g.h;
  const tall = MeshBuilder.CreateGround("map-tall-grass", { width: g.w, height: g.h }, scene);
  tall.position.set(g.x + g.w / 2, 0.02, g.z + g.h / 2);
  tall.material = flat(scene, "map-tall-grass", tallTex);

  // Tree border: one template quad, many instances.
  const treeTex = pixelTexture(scene, "map-tree", 32, (ctx) => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "#5b3b22"; ctx.fillRect(13, 22, 6, 9);                        // trunk
    const blob = (cx: number, cy: number, rad: number, color: string) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    };
    blob(16, 14, 12, "#1f4a24"); blob(15, 12, 10, "#2f6b2f"); blob(13, 10, 6, "#3f8a3a"); blob(11, 8, 2.5, "#5aa64c");
  });
  treeTex.hasAlpha = true;
  const treeMat = flat(scene, "map-tree", treeTex);
  treeMat.useAlphaFromDiffuseTexture = true;
  treeMat.transparencyMode = 1; // alpha test
  const tree = MeshBuilder.CreatePlane("map-tree", { size: 2.4 }, scene);
  tree.rotation.x = Math.PI / 2;
  tree.material = treeMat;
  tree.isVisible = false;
  const place = (x: number, z: number) => {
    const t = tree.createInstance("tree");
    t.position.set(x, layerY(z, 1), z);
    t.rotation.x = Math.PI / 2;
    const s = 0.85 + r() * 0.35;
    t.scaling.set(s, s, s);
  };
  for (let x = -W - 3; x <= W + 3; x += 1.5) {
    for (const z of [D + 0.3, D + 1.8, D + 3.3]) place(x + r() * 0.5, z);
    for (const z of [-D - 0.3, -D - 1.8, -D - 3.3]) place(x + r() * 0.5, z);
  }
  for (let z = -D; z <= D; z += 1.5) {
    for (const x of [W + 0.3, W + 1.8, W + 3.3]) place(x, z + r() * 0.5);
    for (const x of [-W - 0.3, -W - 1.8, -W - 3.3]) place(x, z + r() * 0.5);
  }

  // Tuft drawn over the player's feet while in tall grass.
  const tuftTex = pixelTexture(scene, "map-tuft", 16, (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = "#2c6128"; ctx.fillRect(1, 12, 14, 4);
    ctx.fillStyle = "#62b24f";
    for (const x of [1, 4, 7, 10, 13]) ctx.fillRect(x, 7 + (x % 3), 1, 6);
    ctx.fillStyle = "#86d06a";
    for (const x of [2, 5, 8, 11, 14]) ctx.fillRect(x, 9 + (x % 2), 1, 4);
  });
  tuftTex.hasAlpha = true;
  const tuft = flat(scene, "map-tuft", tuftTex);
  tuft.useAlphaFromDiffuseTexture = true;
  tuft.transparencyMode = 1;

  return {
    scene, camera,
    materials: {
      tuft,
      player: spriteMaterial(scene, "map-player", spriteTexture(scene, "map-player", drawPlayerIdle)),
      boar: spriteMaterial(scene, "map-boar", spriteTexture(scene, "map-boar", drawBoar)),
      alert: spriteMaterial(scene, "map-alert", spriteTexture(scene, "map-alert", drawAlert)),
    },
  };
}

function flatSprite(view: MapView, name: string, size: number, material: StandardMaterial): Mesh {
  const m = MeshBuilder.CreatePlane(name, { size }, view.scene);
  m.rotation.x = Math.PI / 2; // lie flat, top of the sprite toward +z (up on screen)
  m.material = material;
  return m;
}

export function spawnMapPlayer(world: World, view: MapView, at: Vec2): Entity {
  const e = world.spawn();
  world.add(e, MapPos, { x: at.x, z: at.z });
  world.add(e, MapPlayer, { vx: 0, vz: 0, facing: 1, grassDist: 0, safeTime: 0 });
  world.add(e, PlayerInput, { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false });
  const tuft = flatSprite(view, "map-tuft", 1.1, view.materials.tuft);
  tuft.setEnabled(false);
  world.add(e, MapSprite, { mesh: flatSprite(view, "map-player", 1.6, view.materials.player), alert: null, tuft, size: 1.6, walkPhase: 0 });
  return e;
}

export function spawnMapBoar(world: World, view: MapView, at: Vec2): Entity {
  const e = world.spawn();
  world.add(e, MapPos, { x: at.x, z: at.z });
  world.add(e, MapBoar, { state: "idle", t: 0, duration: 1, tx: at.x, tz: at.z, vx: 0, vz: 0, facing: -1 });
  const alert = flatSprite(view, "map-alert", 0.9, view.materials.alert);
  alert.setEnabled(false);
  world.add(e, MapSprite, { mesh: flatSprite(view, "map-boar", 2.0, view.materials.boar), alert, tuft: null, size: 2.0, walkPhase: 0 });
  return e;
}

/** WASD / arrows -> PlayerInput of the map player. Screen-aligned: up is +z. */
export function mapInputSystem(keyboard: Keyboard): System {
  return (world) => {
    for (const [, , input] of world.query(MapPlayer, PlayerInput)) {
      input.moveX = keyboard.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]);
      input.moveZ = keyboard.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]);
    }
  };
}

/** Per render frame: place quads, walk hop, facing, "!" bubble, and the camera follow. */
export function mapViewSystem(view: MapView): System {
  const VIEW_HALF_HEIGHT = 6.5; // tiles visible above/below the player
  return (world, dt) => {
    for (const [e, sprite, pos] of world.query(MapSprite, MapPos)) {
      const mp = world.get(e, MapPlayer), boar = world.get(e, MapBoar);
      const vx = mp?.vx ?? boar?.vx ?? 0, vz = mp?.vz ?? boar?.vz ?? 0;
      const facing = mp?.facing ?? boar?.facing ?? 1;
      const moving = Math.hypot(vx, vz) > 0.1;
      sprite.walkPhase = moving ? sprite.walkPhase + dt * 12 : 0;
      const hop = Math.abs(Math.sin(sprite.walkPhase)) * 0.12;

      // Sprites are anchored at their feet: the quad's center sits half a size above (in +z).
      const footOffset = sprite.size * 0.4;
      sprite.mesh.position.set(pos.x, layerY(pos.z, 0.3), pos.z + footOffset + hop);
      sprite.mesh.scaling.x = facing;

      // In tall grass, a tuft covers the feet (and rustles while walking).
      if (sprite.tuft) {
        const inGrass = inTallGrass(pos.x, pos.z);
        sprite.tuft.setEnabled(inGrass);
        if (inGrass) {
          sprite.tuft.position.set(pos.x, layerY(pos.z, 0.35), pos.z + 0.12);
          sprite.tuft.scaling.x = moving && Math.sin(sprite.walkPhase * 2) > 0 ? -1 : 1;
        }
      }

      if (sprite.alert) {
        const show = boar?.state === "notice" || boar?.state === "chase";
        sprite.alert.setEnabled(show);
        if (show) sprite.alert.position.set(pos.x + 0.2 * facing, 0.6, pos.z + sprite.size * 0.95);
      }
    }

    const me = world.first(MapPlayer, MapPos);
    if (me) {
      const aspect = view.scene.getEngine().getAspectRatio(view.camera);
      const h = VIEW_HALF_HEIGHT, w = h * aspect;
      const cam = view.camera;
      cam.orthoTop = h; cam.orthoBottom = -h; cam.orthoLeft = -w; cam.orthoRight = w;
      // Follow, but don't show past the edge of the world.
      const maxX = Math.max(0, MAP.halfWidth + 3 - w), maxZ = Math.max(0, MAP.halfDepth + 3 - h);
      const tx = Math.max(-maxX, Math.min(maxX, me[2].x));
      const tz = Math.max(-maxZ, Math.min(maxZ, me[2].z));
      const k = 1 - Math.exp(-10 * dt);
      cam.position.x += (tx - cam.position.x) * k;
      cam.position.z += (tz - cam.position.z) * k;
    }
  };
}

/** Snap the camera onto the player (after teleporting them). */
export function snapMapCamera(view: MapView, world: World): void {
  const me = world.first(MapPlayer, MapPos);
  if (me) view.camera.position.set(me[2].x, 30, me[2].z);
}
