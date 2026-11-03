import {
  Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, type ParticleSystem,
} from "@babylonjs/core";
import {
  Body, clamp, dampFactor, Enemy, Health, LocalPlayer, Player, REACTIONS, Skilled, Statuses, type Entity,
  type Reaction, type Theme, type Vec3, type World,
} from "@infinite-tower/shared";
import type { Fight } from "@infinite-tower/shared/fight";
import { showArena } from "../arenas/index.js";
import type { Visual } from "../visuals.js";
import { aimRing } from "./aimRing.js";
import { drawChantWords, dropChantWords, type ChantWords } from "./chantWords.js";
import { impactPose } from "./impact.js";
import type { ArenaScene } from "./scene.js";
import { drawChantCircle, dropChantCircle, type ChantCircle } from "./skills.js";

/** Corrections bigger than this (m), like a hit's knockback, are shown as they are rather than eased. */
const MAX_EASED_CORRECTION = 1;
/** How fast a correction's offset eases away (about 1/rate seconds). */
const CORRECTION_EASE_RATE = 15;
/** Shake decays by e every 1/9 s; below the cutoff it stops. */
const SHAKE_DECAY_PER_SEC = 9;
const SHAKE_CUTOFF = 0.005;
const MARKER_GAP_M = 0.5;
const MARKER_SPIN_RAD_PER_SEC = 2.5;
const PILE_SIZE_M = 1.3;
/** A pile's floor is looked for from this high up. */
const FLOOR_PROBE_M = 5;
/** A dead enemy lies still this long, then crumbles to ash over DISSOLVE_TIME, sinking as it goes. */
const DISSOLVE_DELAY_TIME = 0.5;
const DISSOLVE_TIME = 1;
const DISSOLVE_SINK_M = 0.3;
const ASH_PER_SEC = 160;
const LEAVE_FADE_TIME = 1;

interface Fighter<S> {
  ctx: ArenaScene;
  e: Entity;
  node: TransformNode;
  /** How far the drawing is from its body (m): on a correction it eases after the body. */
  offset: Vec3;
  /** The reaction cooldowns last frame: one jumping is a reaction going off. */
  cooldowns: Record<Reaction, number> | null;
  chant: ChantCircle | null;
  /** Only over other chanters: your own chant is the big popup. */
  words: ChantWords | null;
  /** Seconds since it died (an enemy) or left the arena (a player); 0 while it hasn't. */
  goneTime: number;
  faded: boolean;
  ash: ParticleSystem | null;
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
      return {
        ctx, e, node, offset: { x: 0, y: 0, z: 0 }, cooldowns: null, chant: null, words: null, goneTime: 0, faded: false,
        ash: null,
        drawing: own.spawn(ctx, world, e, node),
      };
    },
    frame(f, world, e, dt) {
      const body = world.require(e, Body), { pos } = body, { offset } = f;
      const dissolving = world.has(e, Enemy) && world.require(e, Health).hp <= 0;
      const leaving = world.get(e, Player)?.leftArena ?? false;
      f.goneTime = dissolving || leaving ? f.goneTime + dt : 0;
      const gone = leaving ? clamp(f.goneTime / LEAVE_FADE_TIME, 0, 1)
        : clamp((f.goneTime - DISSOLVE_DELAY_TIME) / DISSOLVE_TIME, 0, 1);
      for (const c of f.ctx.battle.corrections) if (c.e === e) easeCorrection(offset, c.moved);
      const k = 1 - dampFactor(CORRECTION_EASE_RATE, dt);
      offset.x *= k;
      offset.y *= k;
      offset.z *= k;
      const impact = f.ctx.impacts.get(e), hit = impact && impactPose(impact);
      if (impact) impact.ageMs += dt * 1000;
      if (hit?.done) f.ctx.impacts.delete(e);
      if (hit?.frozen) {
        // Held where it is: it eases after its body once the stop is over.
        const at = f.node.position;
        Object.assign(offset, { x: at.x - pos.x, y: at.y - pos.y, z: at.z - pos.z });
        return;
      }
      const jolt = hit?.offset ?? { x: 0, y: 0, z: 0 }, sinkM = dissolving ? DISSOLVE_SINK_M * gone : 0;
      f.node.position.set(pos.x + offset.x + jolt.x, pos.y + offset.y + jolt.y - sinkM, pos.z + offset.z + jolt.z);
      own.frame(f.drawing, world, e, dt);
      vanish(f, gone, dissolving ? world.require(e, Enemy).def.radius : null);
      const skilled = world.require(e, Skilled);
      f.chant = drawChantCircle(f.ctx.skills, f.chant, skilled, body, f.node);
      if (!world.has(e, LocalPlayer)) f.words = drawChantWords(f.ctx.scene, f.words, skilled, f.node);
      const statuses = world.get(e, Statuses);
      if (!statuses) return;
      if (f.cooldowns) {
        for (const r of REACTIONS) {
          if (statuses.cooldown[r] > f.cooldowns[r] + 1e-6) f.ctx.skills.bursts.reaction(r, pos);
        }
      }
      f.cooldowns = { ...statuses.cooldown };
    },
    dispose(f) {
      if (f.ash) f.ctx.skills.particles.release(f.ash);
      own.dispose(f.drawing);
      dropChantCircle(f.ctx.skills, f.chant);
      dropChantWords(f.words);
      f.node.dispose();
      f.ctx.nodes.delete(f.e);
      f.ctx.impacts.delete(f.e);
    },
  };
}

function vanish(f: Fighter<unknown>, gone: number, ashRadiusM: number | null): void {
  // Back to whole once, if a resync brings it back.
  if (gone > 0 || f.faded) for (const mesh of f.node.getChildMeshes()) mesh.visibility = 1 - gone;
  f.faded = gone > 0;
  f.node.setEnabled(gone < 1);
  const ashing = ashRadiusM !== null && gone > 0 && gone < 1;
  if (ashing && !f.ash) f.ash = f.ctx.skills.particles.stream("ash", ASH_PER_SEC, ashRadiusM);
  if (!ashing && f.ash) {
    f.ctx.skills.particles.release(f.ash);
    f.ash = null;
  }
  if (f.ash) (f.ash.emitter as Vector3).copyFrom(f.node.position);
}

/** The body was just moved by `moved`: the drawing stays where it was, to ease over (or jumps, for a big move). */
function easeCorrection(offset: Vec3, moved: Vec3): void {
  const x = offset.x - moved.x, y = offset.y - moved.y, z = offset.z - moved.z;
  const far = Math.hypot(x, y, z) > MAX_EASED_CORRECTION;
  Object.assign(offset, far ? { x: 0, y: 0, z: 0 } : { x, y, z });
}

export function arenaStage(ctx: ArenaScene): {
  newFight(fight: Fight, theme: Theme): void;
  frame(world: World, dt: number): void;
} {
  const lookAt = new Vector3();
  let arena: { id: string; theme: Theme; root: TransformNode } | null = null;
  const marker = MeshBuilder.CreatePolyhedron("lock-marker", { type: 1, size: 0.12 }, ctx.scene);
  marker.scaling.y = 1.8;
  const material = new StandardMaterial("lock-marker", ctx.scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(1.3, 0.35, 0.25);
  marker.material = material;
  marker.isPickable = false;
  const ring = aimRing(ctx);
  const piles = new Map<number, Mesh>();

  const drawPiles = () => {
    const { drops, fight } = ctx.battle;
    for (const [id, mesh] of piles) {
      if (drops.some((d) => d.id === id)) continue;
      mesh.dispose();
      piles.delete(id);
    }
    for (const { id, x, z } of drops) {
      let mesh = piles.get(id);
      if (!mesh) {
        mesh = MeshBuilder.CreatePlane(`pile-${id}`, { size: PILE_SIZE_M }, ctx.scene);
        mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
        mesh.material = ctx.materials.pile;
        mesh.isPickable = false;
        piles.set(id, mesh);
      }
      const drop = fight?.physics.floorBelow(x, FLOOR_PROBE_M, z, 2 * FLOOR_PROBE_M) ?? FLOOR_PROBE_M;
      mesh.position.set(x, FLOOR_PROBE_M - drop + PILE_SIZE_M / 2, z);
    }
  };

  return {
    newFight(fight, theme) {
      if (arena?.id !== fight.arena.id || arena.theme !== theme) {
        arena?.root.dispose();
        arena = { id: fight.arena.id, theme, root: showArena(ctx, fight.arena, theme) };
      }
      ctx.shake = 0;
      ctx.impacts.clear();
    },
    frame(world, dt) {
      ctx.shake *= Math.exp(-SHAKE_DECAY_PER_SEC * dt);
      const s = ctx.shake > SHAKE_CUTOFF ? ctx.shake : 0;
      const { eye, at } = ctx.battle.view;
      ctx.camera.position.set(
        eye.x + (Math.random() - 0.5) * s, eye.y + (Math.random() - 0.5) * s, eye.z + (Math.random() - 0.5) * s,
      );
      ctx.camera.setTarget(lookAt.set(at.x, at.y, at.z));
      ctx.sky.frame(Date.now(), ctx.camera.position);
      drawPiles();
      ring.frame(world);

      const lock = ctx.battle.lock;
      const body = lock === null ? undefined : world.get(lock, Body);
      marker.setEnabled(body !== undefined);
      if (!body) return;
      marker.position.set(body.pos.x, body.pos.y + 2 * body.centerHeight + MARKER_GAP_M, body.pos.z);
      marker.rotation.y += MARKER_SPIN_RAD_PER_SEC * dt;
    },
  };
}
