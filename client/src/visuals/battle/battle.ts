import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Mesh } from "@babylonjs/core";
import {
  Body, dampFactor, REACTIONS, Statuses, type Entity, type Reaction, type Vec3, type World,
} from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import type { Visual } from "../visuals.js";
import { buildArena } from "./arena.js";
import type { ArenaScene } from "./scene.js";

/** Corrections bigger than this (m), like a hit's knockback, are shown as they are rather than eased. */
const MAX_EASED_CORRECTION = 1;
/** How fast a correction's offset eases away (about 1/rate seconds). */
const CORRECTION_EASE_RATE = 15;
/** Shake decays by e every 1/9 s; below the cutoff it stops. */
const SHAKE_DECAY_PER_SEC = 9;
const SHAKE_CUTOFF = 0.005;
const MARKER_GAP_M = 0.5;
const MARKER_SPIN_RAD_PER_SEC = 2.5;

interface Fighter<S> {
  ctx: ArenaScene;
  e: Entity;
  node: TransformNode;
  /** How far the drawing is from its body (m): on a correction it eases after the body. */
  offset: Vec3;
  /** The reaction cooldowns last frame: one jumping is a reaction going off. */
  cooldowns: Record<Reaction, number> | null;
  drawing: S;
}

export function fighter<S>(name: string, own: {
  spawn(ctx: ArenaScene, world: World, e: Entity, node: TransformNode): S;
  frame(s: S, world: World, e: Entity, dt: number): void;
  dispose(s: S): void;
}): Visual<Fighter<S>> {
  return {
    spawn(ctx, world, e) {
      const node = new TransformNode(`${name}-${e}`, ctx.scene);
      const at = world.require(e, Body).pos;
      node.position.set(at.x, at.y, at.z);
      ctx.nodes.set(e, node);
      return { ctx, e, node, offset: { x: 0, y: 0, z: 0 }, cooldowns: null, drawing: own.spawn(ctx, world, e, node) };
    },
    frame(f, world, e, dt) {
      const { pos } = world.require(e, Body), { offset } = f;
      for (const c of f.ctx.battle.corrections) if (c.e === e) easeCorrection(offset, c.moved);
      const k = 1 - dampFactor(CORRECTION_EASE_RATE, dt);
      offset.x *= k;
      offset.y *= k;
      offset.z *= k;
      f.node.position.set(pos.x + offset.x, pos.y + offset.y, pos.z + offset.z);
      own.frame(f.drawing, world, e, dt);
      const statuses = world.get(e, Statuses);
      if (!statuses) return;
      if (f.cooldowns) {
        for (const r of REACTIONS) {
          if (statuses.cooldown[r] > f.cooldowns[r] + 1e-6) f.ctx.spells.bursts.reaction(r, pos);
        }
      }
      f.cooldowns = { ...statuses.cooldown };
    },
    dispose(f) {
      own.dispose(f.drawing);
      f.node.dispose();
      f.ctx.nodes.delete(f.e);
    },
  };
}

/** The body was just moved by `moved`: the drawing stays where it was, to ease over (or jumps, for a big move). */
function easeCorrection(offset: Vec3, moved: Vec3): void {
  const x = offset.x - moved.x, y = offset.y - moved.y, z = offset.z - moved.z;
  const far = Math.hypot(x, y, z) > MAX_EASED_CORRECTION;
  Object.assign(offset, far ? { x: 0, y: 0, z: 0 } : { x, y, z });
}

export function arenaStage(ctx: ArenaScene): { newFight(fight: Fight): void; frame(world: World, dt: number): void } {
  const lookAt = new Vector3();
  let arena: { radius: number; meshes: Mesh[] } | null = null;
  const marker = MeshBuilder.CreatePolyhedron("lock-marker", { type: 1, size: 0.12 }, ctx.scene);
  marker.scaling.y = 1.8;
  const material = new StandardMaterial("lock-marker", ctx.scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(1.3, 0.35, 0.25);
  marker.material = material;
  marker.isPickable = false;

  return {
    newFight(fight) {
      if (arena?.radius !== fight.arena.radius) {
        for (const mesh of arena?.meshes ?? []) mesh.dispose();
        arena = { radius: fight.arena.radius, meshes: buildArena(ctx, fight.arena.radius) };
      }
      ctx.shake = 0;
    },
    frame(world, dt) {
      ctx.shake *= Math.exp(-SHAKE_DECAY_PER_SEC * dt);
      const s = ctx.shake > SHAKE_CUTOFF ? ctx.shake : 0;
      const { eye, at } = ctx.battle.view;
      ctx.camera.position.set(
        eye.x + (Math.random() - 0.5) * s, eye.y + (Math.random() - 0.5) * s, eye.z + (Math.random() - 0.5) * s,
      );
      ctx.camera.setTarget(lookAt.set(at.x, at.y, at.z));

      const lock = ctx.battle.lock;
      const body = lock === null ? undefined : world.get(lock, Body);
      marker.setEnabled(body !== undefined);
      if (!body) return;
      marker.position.set(body.pos.x, body.pos.y + 2 * body.centerHeight + MARKER_GAP_M, body.pos.z);
      marker.rotation.y += MARKER_SPIN_RAD_PER_SEC * dt;
    },
  };
}
