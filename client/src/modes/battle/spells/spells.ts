import { Vector3, type Mesh, type ParticleSystem } from "@babylonjs/core";
import {
  Body, castTime, Player, REACTIONS, Statuses, type Entity, type Reaction, type System, type Vec3,
} from "@infinite-tower/shared";
import type { FightEvent } from "@infinite-tower/shared/fight";
import { BodyNode } from "../components.js";
import type { BattleContext } from "../context.js";
import { createArcs } from "./arcs.js";
import { createBursts } from "./bursts.js";
import { lookOf, particleKeysOf, type LookKey } from "./looks.js";
import { createObjectDrawings } from "./objects.js";
import { createSpellParticles } from "./particles.js";
import { createSpellShaders } from "./shaders.js";

const FLOOR_REACH_M = 30;
const CHANT_RADIUS_M = 1.3;

interface Circle { look: LookKey; disc: Mesh; motes: ParticleSystem }

export interface SpellEffects {
  addEvents(events: readonly FightEvent[]): void;
  system: System;
  clear(): void;
}

export function createSpellEffects(ctx: BattleContext): SpellEffects {
  const floorY = (at: Vec3) => at.y - (ctx.fight?.physics.floorBelow(at.x, at.y, at.z, FLOOR_REACH_M) ?? 0);
  const shaders = createSpellShaders(ctx.scene);
  const particles = createSpellParticles(ctx.scene);
  const arcs = createArcs(ctx.scene);
  const bursts = createBursts(shaders, particles, arcs, floorY);
  const objects = createObjectDrawings(shaders, particles, arcs, bursts, floorY, ctx.materials.slashFx);
  const circles = new Map<Entity, Circle>();
  const cooldowns = new Map<Entity, Record<Reaction, number>>();
  const right = new Vector3();

  const dropCircle = (e: Entity, c: Circle) => {
    shaders.give(c.disc);
    particles.release(c.motes);
    circles.delete(e);
  };
  const clear = () => {
    objects.clear(ctx.fight?.world ?? null);
    for (const [e, c] of circles) dropCircle(e, c);
    bursts.clear();
    arcs.clear();
    particles.clear();
    cooldowns.clear();
  };

  return {
    clear,
    addEvents(events) {
      for (const event of events) {
        if (event.type !== "spell") continue;
        if (event.form === "nova") bursts.nova(event.elements, event.at, event.radiusM ?? 1);
        else if (event.form === "self") bursts.self(event.elements, event.at);
        else if (event.form === "imbue") bursts.imbue(event.elements, event.at);
      }
    },
    system(world, dt) {
      shaders.tick(dt);
      particles.tick(dt);
      arcs.tick(dt);
      bursts.tick(dt);
      ctx.camera.getDirectionToRef(Vector3.RightReadOnly, right);
      objects.draw(world, dt, right);

      for (const [e, player, body, { node }] of world.query(Player, Body, BodyNode)) {
        const chanting = player.action === "chant" || player.action === "write";
        const spell = player.action === "cast" ? player.casting : null;
        let c = circles.get(e);
        if (!chanting && !spell) {
          if (c) dropCircle(e, c);
          continue;
        }
        const look = spell ? lookOf(spell.segments[0]!.elements) : "none";
        if (c && c.look !== look) {
          dropCircle(e, c);
          c = undefined;
        }
        if (!c) {
          const key = spell ? particleKeysOf(spell.segments[0]!.elements)[0]! : "none";
          const motes = particles.stream(key, 20, CHANT_RADIUS_M * 0.8);
          c = { look, disc: shaders.take("disc", "circle", look), motes };
          circles.set(e, c);
        }
        const feetY = node.position.y - body.centerHeight + 0.04;
        const progress = spell ? Math.min(1, player.actionTime / castTime(spell)) : 1;
        c.disc.position.set(node.position.x, feetY, node.position.z);
        c.disc.scaling.setAll(spell ? 0.7 + 0.3 * progress : CHANT_RADIUS_M);
        c.disc.visibility = spell ? 0.3 + 0.7 * progress : 0.85;
        (c.motes.emitter as Vector3).set(node.position.x, feetY + 0.2, node.position.z);
      }

      for (const [e, statuses, body] of world.query(Statuses, Body)) {
        const was = cooldowns.get(e);
        if (!was) {
          cooldowns.set(e, { ...statuses.cooldown });
          continue;
        }
        for (const r of REACTIONS) if (statuses.cooldown[r] > was[r] + 1e-6) bursts.reaction(r, body.pos);
        Object.assign(was, statuses.cooldown);
      }
    },
  };
}
