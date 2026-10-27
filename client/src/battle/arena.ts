/**
 * The combat arena's scenery: a trampled clearing ringed by standing stones, forest beyond. Sized by the
 * level's ArenaDef; returns its entity so the battle can rebuild it when the size changes. The floor and the wall
 * you bump into are the fight's physics (shared: ArenaPhysics), which the stones and the grass only show.
 */
import { MeshBuilder, type Mesh } from "@babylonjs/core";
import { seededRandom, type Entity } from "@infinite-tower/shared";
import { Meshes } from "./components.js";
import type { BattleContext } from "./context.js";

export function buildArena(ctx: BattleContext): Entity {
  const { world, scene, materials, sunShadows } = ctx;
  const radius = ctx.arena.radius;
  const decor: Mesh[] = [];
  const rand = seededRandom(7); // same stones and trees every time

  const grass = MeshBuilder.CreateGround("grass", { width: 120, height: 120 }, scene);
  grass.material = materials.grass;
  grass.receiveShadows = true;
  decor.push(grass);

  const dirt = MeshBuilder.CreateDisc("dirt", { radius: radius + 1, tessellation: 64 }, scene);
  dirt.rotation.x = Math.PI / 2;
  dirt.position.y = 0.01;
  dirt.material = materials.dirt;
  dirt.receiveShadows = true;
  decor.push(dirt);

  // The wall, shown as a ring of standing stones just outside it.
  const stones = 30;
  for (let i = 0; i < stones; i++) {
    const a = ((i + rand() * 0.4) / stones) * Math.PI * 2;
    const h = 0.8 + rand() * 1.6;
    const w = 0.9 + rand() * 0.8;
    const s = MeshBuilder.CreateBox(`stone-${i}`, { width: w, height: h, depth: 0.7 + rand() * 0.5 }, scene);
    const r = radius + 0.7 + rand() * 0.4;
    s.position.set(Math.sin(a) * r, h / 2 - 0.1, Math.cos(a) * r);
    s.rotation.set((rand() - 0.5) * 0.15, a + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.15);
    s.material = materials.stone;
    s.receiveShadows = true;
    sunShadows.addShadowCaster(s);
    decor.push(s);
  }

  // Forest: instanced trees (one draw call per part however many trees).
  const taperedCylinder = (name: string, height: number, diameterTop: number, diameterBottom: number) =>
    MeshBuilder.CreateCylinder(name, { height, diameterTop, diameterBottom, tessellation: 7 }, scene);
  const trunk = taperedCylinder("trunk", 3, 0.35, 0.55);
  trunk.material = materials.bark;
  const crownLow = taperedCylinder("crown-low", 3.2, 0, 3.4);
  crownLow.material = materials.leaves;
  const crownHigh = taperedCylinder("crown-high", 2.6, 0, 2.4);
  crownHigh.material = materials.leaves;
  for (const m of [trunk, crownLow, crownHigh]) {
    m.isVisible = false; // templates; only instances render
    sunShadows.addShadowCaster(m);
    decor.push(m);
  }
  /** Each part of a tree, and its height on a tree of scale 1. */
  const treeParts: [Mesh, number][] = [[trunk, 1.5], [crownLow, 3.8], [crownHigh, 5.6]];
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius + 4 + rand() * 26;
    const scale = 0.8 + rand() * 0.9;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    for (const [tpl, y] of treeParts) {
      const inst = tpl.createInstance(`${tpl.name}-${i}`);
      inst.position.set(x, y * scale, z);
      inst.scaling.setAll(scale);
      inst.rotation.y = rand() * Math.PI;
      inst.freezeWorldMatrix();
    }
  }

  for (const m of decor) m.freezeWorldMatrix();
  const decorEntity = world.spawn();
  world.add(decorEntity, Meshes, { meshes: decor });
  return decorEntity;
}
