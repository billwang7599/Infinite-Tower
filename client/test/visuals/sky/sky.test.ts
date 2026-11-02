import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Color3, MeshBuilder, NullEngine, PointLight, Scene, ShadowGenerator, StandardMaterial } from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";
import { directLightAt, setDayClock } from "../../../src/visuals/sky/daylight.js";
import {
  cardYawRad, createSky, MAX_MAP_LIGHTS, nearestLights, SHADOW_MAP_LIGHTS, SHADOW_SWAP_MARGIN_M, type MapLight,
} from "../../../src/visuals/sky/sky.js";
import { ARENA_LOOKS } from "../../../src/visuals/arenas/index.js";

describe("a flat shadow card", () => {
  test("turned by cardYawRad, it faces its light square on, so its whole outline falls", () => {
    for (const toLight of [...[0, 0.25, 0.3, 0.5, 0.7, 0.8, 0.95].map((f) => directLightAt(f).toLight),
      { x: -3, y: 1, z: 2 }]) {
      const yaw = cardYawRad(toLight);
      const facing = (Math.sin(yaw) * toLight.x + Math.cos(yaw) * toLight.z) / Math.hypot(toLight.x, toLight.z);
      assert.ok(Math.abs(facing) > 0.9999, JSON.stringify(toLight));
    }
  });
});

describe("map lights", () => {
  const spots: Vec3[] = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }];

  test("the nearest ones are picked, and a picked one is kept until another is clearly nearer", () => {
    assert.deepEqual(nearestLights(spots, { x: 9, y: 0, z: 0 }, 2, []), [0, 1]);
    const at = { x: 15 + SHADOW_SWAP_MARGIN_M / 4, y: 0, z: 0 };
    assert.deepEqual(nearestLights(spots, at, 1, [1]), [1]);
    assert.deepEqual(nearestLights(spots, { x: 20, y: 0, z: 0 }, 1, [1]), [2]);
  });

  test("the sky owner makes them point lights; only the ones nearest the camera cast shadows", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const lights: MapLight[] = spots.map((at) => ({ at, color: new Color3(0.3, 1, 0.8), intensity: 1, rangeM: 6,
      flicker: 0.1 }));
    sky.look(ARENA_LOOKS.mire.env, lights);
    sky.frame(0, { x: 21, y: 2, z: 0 });
    const points = scene.lights.filter((l): l is PointLight => l instanceof PointLight);
    assert.equal(points.length, Math.min(spots.length, MAX_MAP_LIGHTS));
    const shadowed = points.filter((l) => l.shadowEnabled).map((l) => l.position.x).sort((a, b) => a - b);
    assert.equal(shadowed.length, SHADOW_MAP_LIGHTS);
    const camera = { x: 21, y: 2, z: 0 };
    const nearest = [...spots].sort((a, b) => Math.abs(a.x - camera.x) - Math.abs(b.x - camera.x))
      .slice(0, SHADOW_MAP_LIGHTS).map((s) => s.x).sort((a, b) => a - b);
    assert.deepEqual(shadowed, nearest);
    sky.look(ARENA_LOOKS.mire.env, []);
    assert.equal(scene.lights.filter((l) => l instanceof PointLight && l.isEnabled()).length, 0);
    scene.dispose();
  });

  test("a caster can be cast by one light only: its card turned to that light", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const fires: MapLight[] = [0, 10].map((x) => ({ at: { x, y: 1, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3,
      rangeM: 8, flicker: 0 }));
    sky.look(ARENA_LOOKS.mire.env, fires);
    const [sunCard, fireCard, rock] = ["sun-card", "fire-card", "rock"].map((n) => MeshBuilder.CreateBox(n, {}, scene));
    sky.castShadows(sunCard!, "direct");
    sky.castShadows(fireCard!, fires[1]!);
    sky.castShadows(rock!);
    const casting = (light: string) => (scene.getLightByName(light)!.getShadowGenerator() as ShadowGenerator)
      .getShadowMap()!.renderList!.map((m) => m.name);
    assert.deepEqual(casting("sky-body").sort(), ["rock", "sun-card"]);
    assert.deepEqual(casting("map-light-0"), ["rock"]);
    assert.deepEqual(casting("map-light-1").sort(), ["fire-card", "rock"]);
    scene.dispose();
  });

  test("a new look reuses the lights already made, so the scene's materials needn't check their shaders again", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const fire = (x: number): MapLight => ({ at: { x, y: 1, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3,
      rangeM: 8, flicker: 0 });
    const points = () => scene.lights.filter((l): l is PointLight => l instanceof PointLight);
    sky.look(ARENA_LOOKS.mire.env, [fire(0), fire(10)]);
    const made = points();
    sky.look(ARENA_LOOKS.mire.env, [fire(5)]);
    assert.deepEqual(points().filter((l) => l.isEnabled()).map((l) => l.position.x), [5]);
    sky.look(ARENA_LOOKS.mire.env, [fire(1), fire(2)]);
    assert.deepEqual(points(), made);
    assert.deepEqual(points().map((l) => [l.position.x, l.isEnabled()]), [[1, true], [2, true]]);
    scene.dispose();
  });

  test("cleared casters stop casting, for the sun, every lamp and the lamps of the next look", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const fire: MapLight = { at: { x: 0, y: 1, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3, rangeM: 8,
      flicker: 0 };
    sky.look(ARENA_LOOKS.mire.env, [fire]);
    const [rock, card, tree] = ["rock", "card", "tree"].map((n) => MeshBuilder.CreateBox(n, {}, scene));
    sky.castShadows(rock!);
    sky.castShadows(card!, fire);
    sky.clearShadows();
    sky.castShadows(tree!);
    const casting = (light: string) => (scene.getLightByName(light)!.getShadowGenerator() as ShadowGenerator)
      .getShadowMap()!.renderList!.map((m) => m.name);
    assert.deepEqual(casting("sky-body"), ["tree"]);
    assert.deepEqual(casting("map-light-0"), ["tree"]);
    sky.look(ARENA_LOOKS.mire.env, [fire]);
    assert.deepEqual(casting("map-light-0"), ["tree"]);
    scene.dispose();
  });

  test("blob shadows are drawn one per light, and drop when the light goes", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    sky.look(ARENA_LOOKS.mire.env, [{ at: { x: 2, y: 1.2, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3,
      rangeM: 8, flicker: 0 }]);
    setDayClock({ fraction: 0.5, speed: 0 });
    sky.frame(0, { x: 0, y: 5, z: -5 });
    const blobs = sky.blobs(new StandardMaterial("blob", scene), 1, 0.6);
    const shown = () => scene.meshes.filter((m) => m.name === "blob-shadow" && m.isEnabled()).length;
    blobs.place({ x: 0, y: 0, z: 0 }, 0.8);
    assert.equal(shown(), 3);
    blobs.place({ x: 20, y: 0, z: 0 }, 0.8);
    assert.equal(shown(), 2);
    blobs.place(null, 0.8);
    assert.equal(shown(), 0);
    blobs.dispose();
    setDayClock({ speed: 1 });
    scene.dispose();
  });

  test("a sprite's tint stops at its picture's own colours, however much light falls on it", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    sky.look(ARENA_LOOKS.mire.env, [{ at: { x: 0, y: 1, z: 0 }, color: new Color3(1, 1, 1), intensity: 50, rangeM: 6,
      flicker: 0 }]);
    sky.frame(0, { x: 0, y: 2, z: 0 });
    const tint = sky.tintAt({ x: 0, y: 1, z: 0 }, new Color3());
    for (const c of [tint.r, tint.g, tint.b]) assert.ok(c > 0.99 && c <= 1);
    scene.dispose();
  });

  test("every lit material takes the sky's lights and the map's", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const m = new StandardMaterial("m", scene);
    sky.frame(0, { x: 0, y: 2, z: 0 });
    assert.ok(m.maxSimultaneousLights >= 2 + MAX_MAP_LIGHTS);
    scene.dispose();
  });
});
