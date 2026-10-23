/**
 * The combat arena: a trampled clearing ringed by standing stones, forest beyond. Sized by the
 * level's ArenaDef; returns its entities so the battle can rebuild it when the size changes.
 */
import type { Entity } from "@infinite-tower/shared";
import { Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, Vector3 } from "@babylonjs/core";
import { Body, Meshes } from "./components.js";
import { Layer, type GameContext } from "./context.js";

export function buildArena(ctx: GameContext): Entity[] {
  const parts: Entity[] = [];
  const { world, scene, materials, shadows } = ctx;
  const R = ctx.arena.radius;
  const decor: Mesh[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const addCollider = (mesh: Mesh, membership: number) => {
    const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.6, restitution: 0 }, scene);
    aggregate.shape.filterMembershipMask = membership;
    mesh.freezeWorldMatrix();
    const e = world.spawn();
    world.add(e, Body, { aggregate, mesh });
    parts.push(e);
  };

  // Ground: an invisible thick box for physics, visible grass + a dirt circle on top.
  const groundBox = MeshBuilder.CreateBox("ground-collider", { width: 120, depth: 120, height: 1 }, scene);
  groundBox.position.y = -0.5;
  groundBox.isVisible = false;
  addCollider(groundBox, Layer.Ground);

  const grass = MeshBuilder.CreateGround("grass", { width: 120, height: 120 }, scene);
  grass.material = materials.grass;
  grass.receiveShadows = true;
  decor.push(grass);

  const dirt = MeshBuilder.CreateDisc("dirt", { radius: R + 1, tessellation: 64 }, scene);
  dirt.rotation.x = Math.PI / 2;
  dirt.position.y = 0.01;
  dirt.material = materials.dirt;
  dirt.receiveShadows = true;
  decor.push(dirt);

  // Wall: invisible collider ring just outside the radius...
  const segments = 40;
  const segLen = (2 * Math.PI * (R + 0.5)) / segments + 0.2;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const wall = MeshBuilder.CreateBox(`wall-${i}`, { width: segLen, height: 4, depth: 1 }, scene);
    wall.position.set(Math.sin(a) * (R + 0.5), 2, Math.cos(a) * (R + 0.5));
    wall.rotation.y = a;
    wall.isVisible = false;
    addCollider(wall, Layer.Wall);
  }

  // ...shown as a ring of standing stones.
  const stones = 30;
  for (let i = 0; i < stones; i++) {
    const a = ((i + rand() * 0.4) / stones) * Math.PI * 2;
    const h = 0.8 + rand() * 1.6;
    const w = 0.9 + rand() * 0.8;
    const s = MeshBuilder.CreateBox(`stone-${i}`, { width: w, height: h, depth: 0.7 + rand() * 0.5 }, scene);
    const r = R + 0.7 + rand() * 0.4;
    s.position.set(Math.sin(a) * r, h / 2 - 0.1, Math.cos(a) * r);
    s.rotation.set((rand() - 0.5) * 0.15, a + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.15);
    s.material = materials.stone;
    s.receiveShadows = true;
    shadows.addShadowCaster(s);
    decor.push(s);
  }

  // Forest: instanced trees (one draw call per part however many trees).
  const trunk = MeshBuilder.CreateCylinder("trunk", { height: 3, diameterTop: 0.35, diameterBottom: 0.55, tessellation: 7 }, scene);
  trunk.material = materials.bark;
  const crownLow = MeshBuilder.CreateCylinder("crown-low", { height: 3.2, diameterTop: 0, diameterBottom: 3.4, tessellation: 7 }, scene);
  crownLow.material = materials.leaves;
  const crownHigh = MeshBuilder.CreateCylinder("crown-high", { height: 2.6, diameterTop: 0, diameterBottom: 2.4, tessellation: 7 }, scene);
  crownHigh.material = materials.leaves;
  for (const m of [trunk, crownLow, crownHigh]) {
    m.isVisible = false; // templates; only instances render
    shadows.addShadowCaster(m);
    decor.push(m);
  }
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const r = R + 4 + rand() * 26;
    const scale = 0.8 + rand() * 0.9;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const parts: [Mesh, number][] = [[trunk, 1.5], [crownLow, 3.8], [crownHigh, 5.6]];
    for (const [tpl, y] of parts) {
      const inst = tpl.createInstance(`${tpl.name}-${i}`);
      inst.position = new Vector3(x, y * scale, z);
      inst.scaling.setAll(scale);
      inst.rotation.y = rand() * Math.PI;
      inst.freezeWorldMatrix();
    }
  }

  for (const m of decor) m.freezeWorldMatrix();
  const decorEntity = world.spawn();
  world.add(decorEntity, Meshes, { meshes: decor });
  parts.push(decorEntity);
  return parts;
}
