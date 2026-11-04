import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Color3, DirectionalLight, MeshBuilder, NullEngine, PointLight, Scene, ShaderStore, ShadowGenerator, StandardMaterial,
} from "@babylonjs/core";
import { fogFragmentDeclaration } from "@babylonjs/core/Shaders/ShadersInclude/fogFragmentDeclaration.js";
import { sunAt, type Vec3 } from "@infinite-tower/shared";
import { daylightAt, directLightAt, setDayClock } from "../../../src/visuals/sky/daylight.js";
import {
  cardYawRad, createSky, FILL, MAX_MAP_LIGHTS, nearestLights, SHADOW_MAP_LIGHTS, SHADOW_SWAP_MARGIN_M,
  type MapLight, type SkyLook,
} from "../../../src/visuals/sky/sky.js";
import { arenaSky } from "../../../src/visuals/arenas/index.js";
import { REGION_LOOKS } from "../../../src/visuals/regions/index.js";

const MIRE = arenaSky("mire", "mistwood");

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

describe("the moon", () => {
  const litAt = (look: SkyLook, fraction: number) => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    sky.look(look, []);
    setDayClock({ fraction, speed: 0 });
    sky.frame(0, { x: 0, y: 5, z: -5 });
    const [skyLight, body] = ["sky-light", "sky-body"].map((n) => scene.getLightByName(n)!);
    const lit = { skyLight: skyLight!.intensity, body: body!.intensity, ambient: scene.ambientColor.b };
    setDayClock({ speed: 1 });
    scene.dispose();
    return lit;
  };

  test("an open region's night is lit brighter than the Mistwood's, by its moon and the night sky", () => {
    const wood = litAt(REGION_LOOKS.mistwood.env, 0);
    for (const theme of ["grass-field", "kingdom", "quarry"] as const) {
      const open = litAt(REGION_LOOKS[theme].env, 0);
      assert.ok(open.body > wood.body && open.skyLight > wood.skyLight && open.ambient > wood.ambient, theme);
    }
  });

  test("by day the moon's settings change nothing", () => {
    const { env } = REGION_LOOKS["grass-field"];
    const lit = litAt(env, 0.5);
    assert.ok(Math.abs(lit.skyLight - env.skyLight.intensity * daylightAt(0.5).skyLightScale) < 1e-9);
    assert.ok(Math.abs(lit.body - env.sun.intensity * daylightAt(0.5).sunScale) < 1e-9);
  });

  test("a fight is lit by the moon of the region it's in", () => {
    assert.equal(arenaSky("forest-clearing", "grass-field").moon, REGION_LOOKS["grass-field"].env.moon);
    assert.equal(arenaSky("forest-clearing", "mistwood").moon, REGION_LOOKS.mistwood.env.moon);
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
    sky.look(MIRE, lights);
    sky.frame(0, { x: 21, y: 2, z: 0 });
    const points = scene.lights.filter((l): l is PointLight => l instanceof PointLight);
    assert.equal(points.length, Math.min(spots.length, MAX_MAP_LIGHTS));
    const shadowed = points.filter((l) => l.shadowEnabled).map((l) => l.position.x).sort((a, b) => a - b);
    assert.equal(shadowed.length, SHADOW_MAP_LIGHTS);
    const camera = { x: 21, y: 2, z: 0 };
    const nearest = [...spots].sort((a, b) => Math.abs(a.x - camera.x) - Math.abs(b.x - camera.x))
      .slice(0, SHADOW_MAP_LIGHTS).map((s) => s.x).sort((a, b) => a - b);
    assert.deepEqual(shadowed, nearest);
    sky.look(MIRE, []);
    assert.equal(scene.lights.filter((l) => l instanceof PointLight && l.isEnabled()).length, 0);
    scene.dispose();
  });

  test("a caster can be cast by one light only: its card turned to that light", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const fires: MapLight[] = [0, 10].map((x) => ({ at: { x, y: 1, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3,
      rangeM: 8, flicker: 0 }));
    sky.look(MIRE, fires);
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

  test("a caster that can't move casts for a map light only within its reach; one that can, for every light", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const fires: MapLight[] = [0, 40].map((x) => ({ at: { x, y: 1, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3,
      rangeM: 6, flicker: 0 }));
    const box = (name: string, x: number, still: boolean) => {
      const m = MeshBuilder.CreateBox(name, { width: 2 }, scene);
      m.position.x = x;
      if (still) m.freezeWorldMatrix();
      return m;
    };
    sky.castShadows(box("wall-near", fires[0]!.rangeM + 0.9, true));
    sky.castShadows(box("wall-between", 20, true));
    sky.look(MIRE, fires);
    sky.castShadows(box("wall-by-the-far-fire", 37, true));
    sky.castShadows(box("walker", 20, false));
    const casting = (light: string) => (scene.getLightByName(light)!.getShadowGenerator() as ShadowGenerator)
      .getShadowMap()!.renderList!.map((m) => m.name).sort();
    assert.deepEqual(casting("map-light-0"), ["walker", "wall-near"]);
    assert.deepEqual(casting("map-light-1"), ["walker", "wall-by-the-far-fire"]);
    assert.deepEqual(casting("sky-body"), ["walker", "wall-between", "wall-by-the-far-fire", "wall-near"]);
    scene.dispose();
  });

  test("a new look reuses the lights already made, so the scene's materials needn't check their shaders again", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const fire = (x: number): MapLight => ({ at: { x, y: 1, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3,
      rangeM: 8, flicker: 0 });
    const points = () => scene.lights.filter((l): l is PointLight => l instanceof PointLight);
    sky.look(MIRE, [fire(0), fire(10)]);
    const made = points();
    sky.look(MIRE, [fire(5)]);
    assert.deepEqual(points().filter((l) => l.isEnabled()).map((l) => l.position.x), [5]);
    sky.look(MIRE, [fire(1), fire(2)]);
    assert.deepEqual(points(), made);
    assert.deepEqual(points().map((l) => [l.position.x, l.isEnabled()]), [[1, true], [2, true]]);
    scene.dispose();
  });

  test("cleared casters stop casting, for the sun, every lamp and the lamps of the next look", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    const fire: MapLight = { at: { x: 0, y: 1, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3, rangeM: 8,
      flicker: 0 };
    sky.look(MIRE, [fire]);
    const [rock, card, tree] = ["rock", "card", "tree"].map((n) => MeshBuilder.CreateBox(n, {}, scene));
    sky.castShadows(rock!);
    sky.castShadows(card!, fire);
    sky.clearShadows();
    sky.castShadows(tree!);
    const casting = (light: string) => (scene.getLightByName(light)!.getShadowGenerator() as ShadowGenerator)
      .getShadowMap()!.renderList!.map((m) => m.name);
    assert.deepEqual(casting("sky-body"), ["tree"]);
    assert.deepEqual(casting("map-light-0"), ["tree"]);
    sky.look(MIRE, [fire]);
    assert.deepEqual(casting("map-light-0"), ["tree"]);
    scene.dispose();
  });

  test("blob shadows are drawn one per light, and drop when the light goes", () => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    sky.look(MIRE, [{ at: { x: 2, y: 1.2, z: 0 }, color: new Color3(1, 0.5, 0.2), intensity: 3,
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
    sky.look(MIRE, [{ at: { x: 0, y: 1, z: 0 }, color: new Color3(1, 1, 1), intensity: 50, rangeM: 6,
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
    sky.look(MIRE, Array.from({ length: MAX_MAP_LIGHTS }, (_, i) => ({ at: { x: i, y: 1, z: 0 },
      color: new Color3(1, 0.5, 0.2), intensity: 3, rangeM: 8, flicker: 0 })));
    sky.frame(0, { x: 0, y: 2, z: 0 });
    assert.ok(m.maxSimultaneousLights >= scene.lights.length);
    scene.dispose();
  });
});

describe("the sun's light", () => {
  const litAt = (fraction: number) => {
    const scene = new Scene(new NullEngine());
    const sky = createSky(scene);
    sky.look(REGION_LOOKS["grass-field"].env, []);
    setDayClock({ fraction, speed: 0 });
    sky.frame(0, { x: 0, y: 5, z: -5 });
    const [fill, body] = ["sky-fill", "sky-body"].map((n) => scene.getLightByName(n) as DirectionalLight);
    return { scene, sky, fill: fill!, body: body! };
  };
  const done = (scene: Scene) => {
    setDayClock({ speed: 1 });
    scene.dispose();
  };

  test("a fill light comes low from the side away from the sun, cooler and weaker than it", () => {
    const { scene, fill, body } = litAt(0.42), sun = sunAt(0.42), { direction: d } = fill;
    assert.ok(d.x * sun.x + d.z * sun.z > 0);
    assert.ok(d.y < 0 && -d.y < Math.hypot(d.x, d.z));
    assert.ok(Math.abs(fill.intensity - FILL.share * body.intensity) < 1e-9);
    assert.ok(fill.diffuse.b / fill.diffuse.r > body.diffuse.b / body.diffuse.r);
    done(scene);
  });

  test("its glow points at the sun and is warm, and there's none at night", () => {
    const day = litAt(0.42);
    assert.deepEqual(day.sky.glow.toSun, sunAt(0.42));
    assert.ok(day.sky.glow.color.r > day.sky.glow.color.b && day.sky.glow.color.b > 0);
    done(day.scene);
    const night = litAt(0);
    assert.deepEqual(night.sky.glow.color.asArray(), [0, 0, 0]);
    done(night.scene);
  });
});

describe("the fog", () => {
  test("is Babylon's, only also full by the scene's fogEnd when a fogStart is set, so a drawn edge fades out", () => {
    const fog = ShaderStore.IncludesShadersStore.fogFragmentDeclaration!;
    assert.notEqual(fog, fogFragmentDeclaration.shader);
    assert.match(fog, /fogStart>0\.0\)\s*fogCoeff=min\(fogCoeff,\(fogEnd-fogDistance\)\/\(fogEnd-fogStart\)\)/);
  });
});
